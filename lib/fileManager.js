/*eslint es6:true */

'use strict';

var Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    pathUtil = require('path');

/**
 * @method
 * @public
 * Returns the set of files that exist in a current path. Will optionally recurse down the
 * directory tree.
 * @param {object} options Some options. Currently only supports "type" with values "file" or "folder" If set, will only return files or folders, respectively.
 * @param {string} path The root directory to retrieve files from
 * @param {boolean} recurse If true, will recurse to all sub directories
 */
function getFiles(options, path, recurse) {
    return fs.readdirAsync(path)
    .then((files) => {
        /*
         * Note that we use map + filter pattern
         */
        return files.map((file) => {
            let filePath = pathUtil.join(path, file),
                stats = fs.statSync(filePath),
                isDir = stats.isDirectory();

            if (options.type === 'file' && isDir) {
                return;
            }
            if (options.type === 'folder' && !isDir) {
                return;
            }
            if (file === '.globus_id') {
                return;
            }

            return {
                name: file,
                path: filePath,
                mtime: stats.mtime.getTime(),
                size: stats.size,
                isFolder: isDir ? true : false
            };
        }).filter((fileObj) => {
            if (!fileObj) {
                return false;
            }
            return true;
        });
    });
}

/**
 * @method
 * @public
 * Returns whether or not a file exists.
 */
function fileExists(path) {
    return fs.accessAsync(path)
    .then(() => {
        return true;
    }).catch((err) => {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    });
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


module.exports = {
    getFiles: getFiles,
    fileExists: fileExists,
    move: move
};
