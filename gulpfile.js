var gulp = require('gulp'),
    spawn = require('child_process').spawn,
    fs = require('fs');

// not sure about this...
var server;

/**
 * $ gulp server
 * Launch the server in dev mode.  If there's a server already running, kill it.
 * Rebuild docs on start and file change.
 */
gulp.task('server', function () {
    gulp.run('docs')

    if (server) {
        server.kill()
    }
    server = spawn('node', ['server.js', '--dev'], {stdio: 'inherit'})
    server.on('close', function (code) {
        if (code === 8) {
            console.log('Error detected, waiting for changes...');
        }
    });
})

/**
 * $ gulp test
 * Run api tests via jasmine-node.
 */
gulp.task('test', function () {
    server = spawn('jasmine-node', ['./tests/'], {stdio: 'inherit'})
})


/**
 * $ gulp docs
 * Create web documentation data
 */
gulp.task('docs', function () {
    var outputFile = './api-documentation.json'
    var stream = fs.createWriteStream(outputFile);

    var docs = spawn('./docs/parse-docs.js', ['--file', 'server.js'])

    docs.stdout.pipe(stream);
    //docs.stderr.pipe(stream);

    docs.on('close', function (code) {
        console.log('Wrote API documentation JSON to: ' + outputFile);
        //fs.createReadStream(outputFile).pipe(
        //fs.createWriteStream('path to docs')
        //);
    });
})


/**
 * $ gulp
 * Start the development environment
 */
gulp.task('default', function () {
    gulp.run('server')

    gulp.watch(['./server.js', './parsers/*.js', './docs/*.js'], function () {
        gulp.run('server')
    })
})

// clean up if an error goes unhandled.
process.on('exit', function () {
    if (server)
        server.kill()
})
