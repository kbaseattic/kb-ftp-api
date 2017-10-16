/*global process*/
/*eslint es6:true*/
/*jslint white:true,node:true,single:true,multivar:true,es6:true*/
// #!/usr/bin/env node
'use strict';

// External dependencies
const app = require('express')(),
    multer = require('multer'),
    http = require('http').Server(app),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    extend = require('util')._extend,
    cliOptions = require('commander'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    pathUtil = require('path');

/** Internal dependnecies
 * The "env" config file stores volative configuration. It should be created
 * per-deployment. E.g. it switches to one of the "config-ENV.json" files
 * which have per-deployment configuration.
 */
var env = require('./config/env.json'),
    config = require('./config/config-' + env.deployment + '.json'),
    AuthRequired = require('./lib/middlewares/auth')(config),
    ValidatePathInputs = require('./lib/middlewares/validatePathInputs'),
    serviceApiClientFactory = require('./lib/serviceApiClient'),
    writeLog = require('./lib/utils/log'),
    fileManager = require('./lib/fileManager');

cliOptions.version('0.1.0')
    .option('-d, --dev', 'Developer mode; this option attempts to use a token in the file: dev-user-token')
    .parse(process.argv);

// Get the bulkio service token. This token must be set at deployment time
// via the usage of the script 'get-bulkio-token.js'.
// TODO:perhaps this should be placed into "env.json", that being stated
// as the home for volatile configuration.
var serviceToken = require('./tokens/bulkio-service-token.json').token;


// Configure CORs and body parser.
app.use(cors())
    .use(bodyParser.urlencoded({extended: false, limit: '50mb'}))
    .use(bodyParser.json());


// if --dev option is used, set token to token in file "./dev-user-token"
// otherwise, pass on token for all routes, if there is one
if (cliOptions.dev) {
    let token = fs.readFileSync('dev-user-token', 'utf8').trim();
    writeLog('\n\x1b[36m' + 'using development token:' + '\x1b[0m', token, '\n');

    app.all('/', (req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    }).use((req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    });
}


// Handle destination of uploads. The "multer" package provides for
// multipart transfers.
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        /* TODO: CRITICAL:
         * from docs:
         * "Note that req.body might not have been fully populated yet. It depends on
         * the order that the client transmits fields and files to the server."
         *
         * Also, any exceptions being thrown at this point go back to the router,
         * which can crash the server. So a bad request can take down the server.
         * We should probably change that.
         */

        // if multiple files, take path of first
        let reqPath = req.body.destPath;
        let path = reqPath instanceof Array ? reqPath[0] : reqPath;
        var securedReq = securePath(req.session.user, path);

        file.reqPath = securedReq.path + file.originalname;
        file.serverPath = config.ftpRoot + securedReq.path;
        cb(null, file.serverPath);
    },
    filename: (req, file, cb) => {
        // save file to <path>.part first, and then move to <path>
        cb(null, file.originalname + '.part');
    },
});

// Configure Logging
app.use((req, res, next) => {
    writeLog('INFO', `${req.method} ${req.url}`);
    next();
});

/*
 * Given a username and a requested path, ensure that the username matches
 * the username component of the path.
 * returns the requested home and the path with user's home in path
 * if isFile === true, returns as a path to a file, not as a path to a directory
 * (leaves the trailing / off the end)
 */
function securePath(username, path, isFile) {
    path = pathUtil.normalize(path);
    let pathList = path.split('/').filter((s) => {
        return s.length === 0 ? false : true;
    });
    let home = pathList.shift();

    if (home !== username) {
        writeLog('ERROR', 'Username does not match path prefix', {username: username, path: path, home: home});
        throw new Error('User (' + username + ')' +
            ' does not have permission to access: ' + path + '(' + home + ')');
    }

    // replace user with authenticated user
    // why not just take a path without user originally, instead of swapping and
    // later  matching the
    // authenticated user and the path user (later)/
    let allowedPath = ['', username].concat(pathList);
    if (!isFile) {
        allowedPath = allowedPath.concat('');
    }

    return {
        requestedHome: home,
        path: allowedPath.join('/')
    };
}


/*
 * Creates a file called .globus_id with a single token = the globus user id.
 * This is probably in the form of an email, something like "my_user_name@globusid.org"
 * Downstream things (like the add_acl.py script) should deal with that file.
 *
 * Note that this only adds it if the file does not exist.
 */
function addGlobusIdFile(homeDir, globusIds) {
    if (!globusIds || globusIds.length === 0) {
        return
    }
    const idFilePath = homeDir + '/.globus_id';
    // if file exists, return silently
    return fileManager.fileExists(idFilePath)
        .then(exists => {
            if (!exists) {
                return fs.writeFile(idFilePath, globusIds.join('\n'));
            }
        })
        .catch(error => {
            writeLog('ERROR', 'Error writing globus id file', {error: err});
            res.status(500).send({error: err});
        });
}

/**
 * @api {get} /list/:path list files/folders in path
 * @apiName list
 *
 * @apiParam {string} path path to directory
 * @apiParam {string} ?type=(folder|file) only fetch folders or files
 *
 * @apiSampleRequest /list/my/genomes/
 *
 * @apiSuccess {json} meta metadata for listed objects
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *      [
 *       {
 *           name: "blue-panda",
 *           mtime: 1459822597000,
 *           size: 476
 *       }, {
 *           name: "blue-zebra",
 *          mtime: 1458347601000,
 *           size: 170,
 *           isFolder: true
 *       }
 *     ]
 */
app.get('/list/*', AuthRequired, ValidatePathInputs, (req, res) => {
    const user = req.session.user,
        fileListOptions = req.query,
        requestedPath = req.params[0],
        globusIds = req.session.globusUserIds;

    try {
        var securedReq = securePath(user, requestedPath);
    } catch (ex) {
        res.status(403).send({error: ex.message});
        return;
    }

    const rootDir = config.ftpRoot,
        path = securedReq.path,
        fullPath = pathUtil.join(rootDir, path),
        userDir = pathUtil.join(rootDir, user);

    fileManager.fileExists(userDir)
        .then(function (exists) {
            /*
             * If a directory does not exist for this user,
             * create a directory and give the user RW access via globus
             * transfer ACL.
             */
            if (!exists) {
                return fs.mkdirAsync(userDir);
            }
        })
        .then(function () {
            /*
             * Write the globus id file if it doesn't exist already.
             */
            return addGlobusIdFile(userDir, globusIds);
        })
        .then(function () {
            /*
             * Return a list of the file contents. Note that there is some
             * filtering here -- the request may ask for files or folders.
             */
            return fileManager.getFiles(fullPath, fileListOptions);
        })
        .then(function (files) {
            res.send(files);
        })
        .catch(function (err) {
            writeLog('ERROR', 'Error listing directory contents', {error: err});
            res.status(500).send({error: err});
        });
})
    .get('/search/*', AuthRequired, (req, res) => {
        const user = req.session.user,
              query = req.params[0],
              rootDir = config.ftpRoot,
              userDir = pathUtil.join(rootDir, user);

        fileManager.fileExists(userDir)
            .then(exists => {
                if (!exists) {
                    throw new Error({
                        code: 'ENOENT',
                        error: 'no such file or directory to search from',
                        path: userDir
                    });
                }
                return fileManager.search(userDir, query, false);
            })
            .then(results => {
                res.send(results);
            })
            .catch(err => {
                writeLog('ERROR', 'Error searching user directory', {error: err});
                res.status(500).send({error: err});
            });
    })

    /**
     * @api {post} /upload post endpoint to upload data
     * @apiName upload
     *
     * @apiSampleRequest /upload/
     *
     * @apiSuccess {json} meta meta on data uploaded
     * @apiSuccessExample {json} Success-Response:
     *     HTTP/1.1 200 OK
     *     [{
     "path": "/nconrad/Athaliana.TAIR10_GeneAtlas_Experiments.tsv",
     "size": 3190639,
     "encoding": "7bit",
     "name": "Athaliana.TAIR10_GeneAtlas_Experiments.tsv"
     }, {
     "path": "/nconrad/Sandbox_Experiments-1.tsv",
     "size": 4309,
     "encoding": "7bit",
     "name": "Sandbox_Experiments-1.tsv"
     }]
     */
    .post("/upload", AuthRequired, multer({storage: storage, onError: (err) => { console.error('GOT AN ERROR'); res.status(500).send; }}).array('uploads', 12),
        (req, res) => {
        let user = req.session.user,
            globusIds = req.session.globusUserIds,
            log = [],
            proms = [],
            response = [];

        const rootDir = config.ftpRoot,
            userDir = [rootDir, user].join('/');

        req.files.forEach(f => {
            log.push(f.reqPath);
            response.push({
                path: f.reqPath,
                name: f.originalname,
                size: f.size,
                mtime: Date.now()
            });

            proms.push(fileManager.move(f.path, f.serverPath + f.originalname));
        });
        proms.push(addGlobusIdFile(userDir, globusIds));

        Promise.all(proms)
            .then(() => {
                writeLog('INFO', 'user (' + user + ') uploaded:\n', log.join('\n'));
                res.send(response);
            })
            .catch((error) => {
                // TODO: this error should propagate!
                writeLog('ERROR', 'move error', error);
            });
    })

    /**
     * @api {get} /test-service/  Way to test simple, unauthenticated GET request.
     *  Note: no version "v0", "v1", etc, in the endpoint.
     *
     * @apiName test-service
     *
     * @apiSampleRequest /test-server/
     *
     * @apiSuccess {json} string Should return code 200 with string
     *  "This is just a test. This is only a test."
     *
     */
    .get('/test-service', (req, res) => {
        res.status(200).send('This is just a test. This is only a test.');
    })
    .get('/test-auth', AuthRequired, (req, res) => {
        res.status(200).send('I\'m authenticated as ' + req.session.user);
    });

/*
 * Handle import ujs operations:
 * - post /import-jobs : create a ujs job for the given actual jobs. Returns ujs job id
 * - get /import-jobs : return all import jobs for this user
 * - delete /import-job/JOB_ID : delete import job for this user
 */
app
    .post('/import-jobs', AuthRequired, (req, res) => {
        /*
         * Creates an import-jobs record in UJS. The UJS job description
         * stores a list of of import job ids provided, and the
         * job status stores the object id for the target narrative.
         * The progress and completion are not used, so are set to sensible dummy values.
         */
        var ujs = serviceApiClientFactory.make({
                name: 'UserAndJobState',
                url: config.services.user_job_state.url,
                token: req.session.token
            }),
            jobStatus = req.body.narrativeObjectId,
            jobDescription = req.body.jobIds.join(','),
            progress = {ptype: 'percent'},
            completionEstimate = '9999-04-03T08:56:32+0000';

        ujs.rpcRequest('create_and_start_job', [serviceToken, jobStatus, jobDescription, progress, completionEstimate])
            .then(function (results) {
                res.status(200).send({result: results});
            })
            .catch(function (err) {
                writeLog('ERROR', 'Error creating import job', {error: err});
                res.status(500).send({error: err});
            });
    })
    .get('/import-jobs', AuthRequired, (req, res) => {
        /*
         * Fetch all the ujs import job records for this user.
         */
        var ujs = serviceApiClientFactory.make({
            name: 'UserAndJobState',
            url: config.services.user_job_state.url,
            token: req.session.token
        });
        ujs.rpcRequest('list_jobs', [['bulkio'], ''])
            .then(function (results) {
                res.status(200).send({result: results});
            })
            .catch(function (err) {
                writeLog('ERROR', 'Error listing import jobs', {error: err});
                res.status(500).send({error: err});
            });
    })
    .get('/import-job/:jobid', AuthRequired, (req, res) => {
        /*
         * Fetch the ujs job info for a given ujs job id.
         */
        var ujs = serviceApiClientFactory.make({
            name: 'UserAndJobState',
            url: config.services.user_job_state.url,
            token: req.session.token
        });
        ujs.rpcRequest('get_job_info', [req.params.jobid])
            .then(function (results) {
                res.status(200).send({result: results});
            })
            .catch(function (err) {
                writeLog('ERROR', 'Error getting import job info', {error: err});
                res.status(500).send({error: err});
            });

    })
    .delete('/import-job/:jobid', AuthRequired, (req, res) => {
        /*
         * Delete the given ujs job. This provides the UI function in which a
         * user may remove an import job from their import listing panel.
         */
        var ujs = serviceApiClientFactory.make({
                name: 'UserAndJobState',
                url: config.services.user_job_state.url,
                token: req.session.token
            }),
            // for for now
            jobIdToDelete = req.params.jobid;

        ujs.rpcRequest('force_delete_job', [serviceToken, jobIdToDelete])
            .then(function (results) {
                // writeLog('deleted import job', {results: results);
                res.status(200).send({result: true});
            })
            .catch(function (err) {
                writeLog('ERROR', 'error deleting import job', {error: err});
                res.status(500).send({error: err});
            });
    })
    .delete('/file/*', AuthRequired, ValidatePathInputs, (req, res) => {
        /**
         * Deletes the given file, the path to which is denoted by the whole
         * input. This path is relative to the user's root. So, for user
         * kbase, if they want to delete some file "my_file.txt" in a folder "foo",
         * the param should be "foo/my_file.txt", which gets translated to
         * /dataroot/kbase/foo/my_file.txt
         *
         * Only FILES are accepted here. Go elsewhere to delete directories.
         */
        const user = req.session.user,
            requestedPath = req.params[0];

        try {
            var securedReq = securePath(user, requestedPath, true);
        } catch (ex) {
            res.status(403).send({error: ex.message});
            return;
        }

        const rootDir = config.ftpRoot,
            path = securedReq.path,
            fullPath = pathUtil.join(rootDir, path);

        writeLog('INFO', 'trying to delete ' + fullPath);
        fileManager.deleteFile(fullPath)
            .then((results) => {
                writeLog('INFO', 'File deleted', {results: results});
                res.status(200).send({result: true});
            })
            .catch((err) => {
                writeLog('ERROR', 'Error deleting user file', {error: err, path: fullPath});
                res.status(500).send({error: err});
            });
    });


var server = http.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;

    writeLog('INFO', `Service listening at http://${host}:${port}`);
});
