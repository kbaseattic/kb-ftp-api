#!/usr/bin/env node
'use strict';

// application config
var config = require('./config.json');

var app         = require('express')(),
    http        = require('http').Server(app),
    cors        = require('cors'),
    bodyParser  = require('body-parser');

var request         = require('request'),
    extend          = require('util')._extend,
    cliOptions 	    = require('commander'),
    fs              = require('fs'),
    pathUtil        = require('path'),
    execSync        = require('child_process').execSync,
    when            = require("promised-io/promise").when;

var validateToken 	= require('./lib/validateToken.js');



cliOptions.version('0.0.1')
           .option('-d, --dev', 'Developer mode; this option attempts to use a token in the file: dev-user-token')
           .parse(process.argv);


// if --dev option is used, set token to token in file "./dev-user-token"
// otherwise, pass on token, if there is one
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

// Configure CORs and body parser.
app.use( cors() )
   .use( bodyParser.urlencoded({extended: false, limit: '50mb'}) );


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
 * @apiSampleRequest /list/my/models/
 *
 * @apiSuccess {json} meta metadata for listed objects
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *      [
 *       {
 *           name: "blue-panda",
 *           mtime: 1459822597000,
 *           size: 476,
 *           is_dir: true
 *       }, {
 *           name: "blue-zebra",
  *          mtime: 1458347601000,
 *           size: 170,
 *           is_dir: true
 *       }
 *     ]
 */
app.get('/v0/list/*', AuthRequired, (req, res) => {
    console.log('req.user.id', req.user.id)
    const opts = req.query;

    const rootDir = config.ftpRoot,
          path = '/'+req.params[0],
          fullPath = rootDir+path;

    let files = [];
    fs.readdirSync(fullPath).forEach( (file) => {
        let filePath = pathUtil.join(fullPath, file),
            stats = fs.statSync(filePath),
            isDir = stats.isDirectory();

        if (opts.type === 'file' && isDir) return;
        if (opts.type === 'folder' && !isDir) return;

        let fileObj = {
            name: file,
            path: path+'/'+file,
            mtime: stats.mtime.getTime(),
            size: stats.size
        }

        // additional info if is directory
        if (isDir) {
            fileObj.isFolder = true;
            fileObj.folderCount = parseInt( execSync('find "' +
                filePath+'" -maxdepth 1 -type d | wc -l').toString() ) - 1;
        }

        files.push(fileObj)
    });

    res.send(files)
})


/**
 * @api {get} /quota get spaced used and total allowed for user (not in use!)
 * @apiName quota
 *
 *
 * @apiSampleRequest /quota/
 *
 * @apiSuccess {json} meta give used/available space for user
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        used: used,
 *        available: 1000000
 *     }
 */
/*
.get('/v0/quota', AuthRequired, (req, res) => {
    const opts = req.query;
    const userDir = '/Users/nc/';

    let str = execSync("du -s "+userDir).toString(),
        e = str.indexOf('\t');
    let used = parseInt(str.slice(0, e));

    let quota = {
        used: used,
        available: 1000000
    }

    res.send(quota);
})
*/


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



var server = http.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
