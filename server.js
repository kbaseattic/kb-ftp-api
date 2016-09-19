#!/usr/bin/env node
'use strict';

// application config
var config = require('./config.json');

var app             = require('express')(),
    multer          = require('multer'),
    http            = require('http').Server(app),
    cors            = require('cors'),
    bodyParser      = require('body-parser');

var request         = require('request'),
    extend          = require('util')._extend,
    cliOptions 	    = require('commander'),
    fs              = require('fs'),
    pathUtil        = require('path'),
    execSync        = require('child_process').execSync,
    Promise         = require('promise'),
    when            = require("promised-io/promise").when;

var validateToken 	= require('./lib/validateToken.js');



cliOptions.version('0.0.1')
           .option('-d, --dev', 'Developer mode; this option attempts to use a token in the file: dev-user-token')
           .parse(process.argv);

// Configure CORs and body parser.
app.use( cors() )
   .use( bodyParser.urlencoded({extended: false, limit: '50mb'}) );


// if --dev option is used, set token to token in file "./dev-user-token"
// otherwise, pass on token for all routes, if there is one
if (cliOptions.dev) {
    let token = fs.readFileSync('dev-user-token', 'utf8').trim();
    console.log('\n\x1b[36m'+'using development token:'+'\x1b[0m', token, '\n')

    app.all('/', (req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    }).use((req, res, next) => {
        req.headers = {"Authorization": token};
        next();
    })
}

// handle desination of uploads
let storage = multer.diskStorage({
    destination: (req, file, cb) => {
        
        // if multiple files, take path of first
        let reqPath = req.body.destPath;
        let path = reqPath instanceof Array ? reqPath[0] : reqPath;
        let securedReq = securePath(req.user.id, path)
        
        file.reqPath = securedReq.path+file.originalname;
        file.serverPath = config.ftpRoot+securedReq.path;
        cb(null, file.serverPath);        
    },
    filename: (req, file, cb) => {
        // save file to <path>.part first, and then move to <path>        
        file.tmpPath = file.serverPath+file.originalname+'.part';
        cb(null, file.originalname+'.part')
    }
})

// Configure Logging
app.use( (req, res, next) => {
    console.log('%s %s', req.method, req.url);
    next();
});


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
app.get('/v0/list/*', AuthRequired, (req, res) => {
    console.log('req.user.id:', req.user.id);    
    const user = req.user.id,
          opts = req.query;

    const requestedPath = req.params[0];
    const securedReq = securePath(user, requestedPath);

    // throw error if user doesn't have access
    if (user != securedReq.requestedHome) {
        let msg = 'User ('+user+')'+
                ' does not have permission to access: '
                + requestedPath
        res.status(403).send({error: msg});
        return;
    }

    const rootDir = config.ftpRoot,
          path = securedReq.path,
          fullPath = rootDir+path;

    // check if user has home
    let hasHome = false;
    try {
        hasHome = fs.statSync(rootDir+'/'+user).isDirectory();        
    } catch(e) {
        console.log("User's home not found:", user);
    }

    // if needed, create user's directory and enable acl's
    if (!hasHome) {
        let scriptPath = '/root/add_acl_dolson.py';
        try {
            let scriptRes = execSync(scriptPath+' --share-dir="'+rootDir+'/'+
                user+'/" --share-name="'+user+'"');
        } catch(e) {
            let msg = 'User ('+user+')'+
                ' does not have a directory and server could not run share script: '
                + scriptPath

            console.log(msg);
            res.status(500).send({error: msg});
            return;
        }
    }

    // generate list of objects describing contents
    let files = [];
    fs.readdirSync(fullPath).forEach( (file) => {
        let filePath = pathUtil.join(fullPath, file),
            stats = fs.statSync(filePath),
            isDir = stats.isDirectory();

        if (opts.type === 'file' && isDir) return;
        if (opts.type === 'folder' && !isDir) return;

        let fileObj = {
            name: file,
            path: path+file,
            mtime: stats.mtime.getTime(),
            size: stats.size
        }

        // additional info if is directory
        if (isDir) {
            fileObj.isFolder = true;
            //fileObj.folderCount = parseInt( execSync('find "' +
            //    filePath+'" -maxdepth 1 -type d | wc -l').toString() ) - 1;
        }

        files.push(fileObj);
    });

    res.send(files);
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
.post("/v0/upload",  AuthRequired, multer({ storage: storage }).array('uploads', 12), 
    (req, res) => {
    let user = req.user.id;

    let proms = [],
        log = [], 
        response = [];

    req.files.forEach(f => {
        log.push(f.path);
        response.push({
            path: f.reqPath,            
            name: f.originalname,        
            size: f.size,
            mtime: Date.now()
        })

        proms.push( move(f.tmpPath, f.serverPath+f.originalname) )
    })

    Promise.all(proms).then((result) => {
        console.log('user ('+user+') uploaded:', f.reqPath)
        res.send(response);
    }).catch((error) => {
        console.log('move error', error)
    })
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
    res.status(200).send( 'This is just a test. This is only a test.' );
})


function AuthRequired(req, res, next) {
    // if no token at all, return 401
    if (!('authorization' in req.headers)) {
        res.status(401).send( {error: 'Auth is required!'} );
    }

    when(validateToken(req.headers.authorization),
        userObj => {
            if (!(userObj && 'id' in userObj)) {
                res.status(401).send( {error: 'Invalid token!'} );
                return;
            }

            // Pass user id along
            req.user = userObj;

            // safe to move along.
            next();
        })
}

// takes user and requested path
// returns the requested home and the path with user's home in path
function securePath(user, path) {
    let pathList = path.split('/').filter(s => { 
        if (s !== '') return true;
    })
    let home = pathList.shift();

    // replace user with authenticated user
    let allowedPath = '/'+user+'/'+pathList.join('/');    

    return {
        requestedHome: home,
        path: allowedPath
    }
}

function move(oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, function (err) {
            if (err) 
                reject('could not move .part file; '+oldPath+' => '+newPath);
            else 
                resolve();
        });
    });
}

var server = http.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Service listening at http://%s:%s', host, port);
});
