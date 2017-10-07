'use strict';

const Promise = require('bluebird'),
      fs = Promise.promisifyAll(require('fs')),
      pathUtil = require('path');

/**
 * @method
 * @public
 * Returns whether or not a file exists.
 */
const fileExists = function(path) {
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
};

/**
 * @method
 * @public
 * Returns the set of files that exist in a current path. Will optionally recurse down the
 * directory tree.
 * @param {string} path The root directory to retrieve files from
 * @param {object} options Some options. Allowed keys:
 *     type {string} - supports "file" or "folder". If set, will only return files or folders, respectively.
 *     deep {boolean} - if true, will fetch files from all sub directories (default is false).
 *     query {string} - if present, will only return files (and directories) with that query as a substring of the name.
 */
const getFiles = function(path, options) {
    options = options || {};
    return fs.readdirAsync(path)
        .then((files) => {
            /*
             * Note that we use map + filter pattern
             */
            let dirList = [];
            files = files.map((file) => {
                let filePath = pathUtil.join(path, file),
                    stats = fs.statSync(filePath),
                    isDir = stats.isDirectory();

                if (isDir) {
                    dirList.push(filePath);
                    if (options.type === 'file') {
                        return;
                    }
                }
                if (options.type === 'folder' && !isDir) {
                    return;
                }
                if (file === '.globus_id') {
                    return;
                }
                if (options.query && filePath.indexOf(options.query) === -1) {
                    return;
                }

                return {
                    name: file,
                    path: filePath,
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
            // Incoming recursion...
            if (options.deep && dirList.length) {
                // map all paths given in dirList onto separate getFiles promises.
                // when those return, concat them to the mail files list.
                return Promise.map(dirList, (subDir) => {
                    return getFiles(subDir, options)
                        .then((subFiles) => {
                            files = files.concat(subFiles);
                        });
                }).then(() => {
                    return files;
                });
            }
            else {
                return files;
            }
    });
};

/*
 * Async wrapping of move ...
 * TODO: this should just be using renameAsync, since we've alreay wrapped
 * fs in bluebird.
 */
const move = function (oldPath, newPath) {
    return new Promise((resolve, reject) => {
        fs.rename(oldPath, newPath, (err) => {
            if (err) {
                reject('could not move .part file; ' + oldPath + ' => ' + newPath);
            }
            else {
                resolve();
            }
        });
    });
};

module.exports = {
    getFiles: getFiles,
    fileExists: fileExists,
    move: move
};
