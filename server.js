/*global process*/
/*jslint white:true,node:true,single:true,multivar:true,es6:true*/
// #!/usr/bin/env node
'use strict';

// External dependencies
var app = require('express')(),
    multer = require('multer'),
    http = require('http').Server(app),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    request = require('request'),
    extend = require('util')._extend,
    cliOptions = require('commander'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    pathUtil = require('path'),
    // execSync = require('child_process').execSync,
    Promise = require('promise'),
    when = require('promised-io/promise').when;

// Internal deps
var validateToken = require('./lib/validateToken.js'),
    serviceApiClientFactory = require('./lib/serviceApiClient'),
    transferClient = require('./lib/globusTransfer'),
    utils = require('./lib/utils');


cliOptions.version('0.1.0')
    .option('-d, --dev', 'Developer mode; this option attempts to use a token in the file: dev-user-token')
    .parse(process.argv);

// Configuration
/*
 * The "env" config file stores volative configuration. It should be created
 * per-deployment. E.g. it switches to one of the "config-ENV.json" files
 * which have per-deployment configuration.
 */
var env = require('./config/env.json');
var config = require('./config/config-' + env.deployment + '.json');

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
    console.log('\n\x1b[36m' + 'using development token:' + '\x1b[0m', token, '\n');

    app.all('/', (req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    }).use((req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    });
}


// handle desination of uploads. The "multer" package provides for
// multipart transfers.
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log(req.session)
        // if multiple files, take path of first
        let reqPath = req.body.destPath;
        let path = reqPath instanceof Array ? reqPath[0] : reqPath;
        let securedReq = securePath(req.session.user, path);

        file.reqPath = securedReq.path + file.originalname;
        file.serverPath = config.ftpRoot + securedReq.path;
        cb(null, file.serverPath);
    },
    filename: (req, file, cb) => {
        // save file to <path>.part first, and then move to <path>
        cb(null, file.originalname + '.part');
    }
});

// Configure Logging
app.use((req, res, next) => {
    utils.log('INFO', `${req.method} ${req.url}`);
    next();
});

/*
 * Since fs.exists is deprecated, this gives us an equivalent async
 * method.
 */
function fileExists(path) {
    return fs.accessAsync(path)
        .then(() => {
            return true;
        })
        .catch((err) => {
            if (err.code === 'ENOENT') {
                return false;
            }
            throw err;
        });
}

function AuthRequired(req, res, next) {
    // if no token at all, return 401
    if (!('authorization' in req.headers)) {
        res.status(401).send({error: 'Auth is required!'});
        return;
    }
    validateToken(config.services.auth.url, req.headers.authorization)
    .then(sessionObj => {
        if (!sessionObj) {
            res.status(401).send({error: 'Invalid token!'});
            return;
        }

        // Pass user id along
        req.session = sessionObj;

        // safe to move along.
        next();
    }).catch(error => {
        res.status(500).send({error: 'Unable to validate authentication credentials'});
        return;
    });
}

/*
 * Given a username and a requested path, ensure that the username matches
 * the username component of the path.
 * returns the requested home and the path with user's home in path
*/
function securePath(username, path) {
    let pathList = path.split('/').filter( (s) => {
        return s.length === 0 ? false : true;
    });
    let home = pathList.shift();

    if (home !== username) {
        utils.log('ERROR', 'Username does not match path prefix', {username: username, path: path, home: home});
        throw new Error('User (' + username + ')' +
            ' does not have permission to access: ' + path + '(' + home + ')');
    }

    // replace user with authenticated user
    // why not just take a path without user originally, instead of swapping and
    // later  matching the
    // authenticated user and the path user (later)/
    let allowedPath = ['', username].concat(pathList).concat('').join('/');

    return {
        requestedHome: home,
        path: allowedPath
    };
}

/*
 * Async wrapping of move ...
 * TODO: this should just be using renameAsync, since we've alreay wrapped
 * fs in bluebird.
 */
function move(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, function (err) {
            if (err)
                reject('could not move .part file; ' + oldPath + ' => ' + newPath);
            else
                resolve();
        });
    });
}

/*
 * Creates a file called .globus_id with a single token = the globus user id.
 * This is probably in the form of an email, something like "my_user_name@globusid.org"
 * Downstream things (like the add_acl.py script) should deal with that file.
 *
 * Note that this only adds it if the file does not exist.
 */
function addGlobusIdFile(homeDir, globusUserId) {
    if (!globusUserId) {
        return
    }
    let idFilePath = homeDir + '/.globus_id'
    // if file exists, return silently
    return fileExists(idFilePath)
        .then(exists => {
            if (!exists) {
                return fs.writeFile(idFilePath, globusUserId)
            }
        })
        .catch(error => {
            utils.log('ERROR', 'Error writing globus id file', {error: err})
            res.status(500).send({error: err})
        })
}

/**
 * @api {get} /list/:path list files/folders in path
 * @apiName list
 *
 * @apiParam {string} path path to directory
 * @apiParam {string} ?type=(folders|files) only fetch folders or files
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
app.get('/list/*', AuthRequired, (req, res) => {
    const user = req.session.user,
        fileListOptions = req.query,
        requestedPath = req.params[0],
        globusId = req.session.globusUser;

    try {
        var securedReq = securePath(user, requestedPath);
    } catch (ex) {
        res.status(403).send({error: ex.message});
        return;
    }

    const rootDir = config.ftpRoot,
        path = securedReq.path,
        fullPath = rootDir + path,
        userDir = [rootDir, user].join('/');

    fileExists(userDir)
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
            return addGlobusIdFile(userDir, globusId)
        })
        .then(function () {
            /*
             * Return a list of the file contents. Note that there is some
             * filtering here -- the request may ask for files or folders.
             *
             */
            return fs.readdirAsync(fullPath)
                .then(function (files) {
                    /*
                     * Note that we use map + filter pattern
                     */
                    return files.map((file) => {
                        let filePath = pathUtil.join(fullPath, file),
                            stats = fs.statSync(filePath),
                            isDir = stats.isDirectory();

                        if (fileListOptions.type === 'file' && isDir) {
                            return;
                        }
                        if (fileListOptions.type === 'folder' && !isDir) {
                            return;
                        }
                        if (file === '.globus_id') {
                            return;
                        }

                        return {
                            name: file,
                            path: path + file,
                            mtime: stats.mtime.getTime(),
                            size: stats.size,
                            isFolder: isDir ? true : false
                        };
                    })
                        .filter((fileObj) => {
                            if (!fileObj) {
                                return false;
                            }
                            return true;
                        });
                });
        })
        .then(function (files) {
            res.send(files);
        })
        .catch(function (err) {
            utils.log('ERROR', 'Error listing directory contents', {error: err});
            res.status(500).send({error: err});
        });
})


    /**
     * @api {get} /upload post endpoint to upload data
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
    .post("/upload", AuthRequired, multer({storage: storage}).array('uploads', 12),
        (req, res) => {
        let user = req.session.user,
            globusId = req.session.globusUser,
            proms = [],
            log = [],
            response = [];

        const rootDir = config.ftpRoot,
            userDir = [rootDir, user].join('/');

        console.log(req.files)

        req.files.forEach(f => {
            log.push(f.reqPath);
            response.push({
                path: f.reqPath,
                name: f.originalname,
                size: f.size,
                mtime: Date.now()
            });

            proms.push(move(f.path, f.serverPath + f.originalname));
        });
        proms.push(addGlobusIdFile(userDir, globusId));


        Promise.all(proms)
            .then(() => {
                utils.log('INFO', 'user (' + user + ') uploaded:\n', log.join('\n'));
                res.send(response);
            })
            .catch((error) => {
                // TODO: this error should propagate!
                utils.log('ERROR', 'move error', error);
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
                utils.log('ERROR', 'Error creating import job', {error: err});
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
                utils.log('ERROR', 'Error listing import jobs', {error: err});
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
                utils.log('ERROR', 'Error getting import job info', {error: err});
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
                // log('deleted import job', {results: results);
                res.status(200).send({result: true});
            })
            .catch(function (err) {
                utils.log('ERROR', 'error deleting import job', {error: err});
                res.status(500).send({error: err});
            });
    });




var server = http.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;

    utils.log('INFO', `Service listening at http://${host}:${port}`);
});
