#!/usr/bin/env node

/**
 * This file parses the server API and produces a JSON structure.
 * This JSON structure is then used to produce fancy documentation,
 * in a pretty fancy way.
 */

var fs = require('fs')

var parse = require('comment-parser'),
	opts = require('commander');

opts.version('0.0.1')
    .option('-f, --file [value]', 'File to parse')
    .parse(process.argv);


fs.readFile(opts.file, 'utf8', function (err,data) {
    if (err) return console.log(err);

    var comments = data.match(/\/\*\*(.|\n)+?\*\//g);

    var docs = [];
    for (var i in comments) {
        docs.push( parse(comments[i]) )
    }

    console.log(JSON.stringify(docs, null, 4) )
});
