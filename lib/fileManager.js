'use strict';

const Promise = require('bluebird'),
      fs = Promise.promisifyAll(require('fs')),
      pathUtil = require('path'),
      log = require('./utils/log');

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
const getFiles = function(path, options, rootPath) {
    options = options || {};
    rootPath = rootPath || path;
    // don't need the leading ./, can cause filtering problems with searching, too
    if (rootPath.startsWith('./')) {
        rootPath = rootPath.slice(2);
    }
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
                if (options.query) {
                    let queryPath = filePath;
                    if (queryPath.startsWith(rootPath)) {
                        queryPath = queryPath.slice(rootPath.length);
                    }
                    if (queryPath.indexOf(options.query) === -1) {
                        return;
                    }
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
                    return getFiles(subDir, options, rootPath)
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

const search = function(rootPath, query, includeFolders) {
    const searchParams = {
        query: query,
        deep: true
    };
    if (!includeFolders) {
        searchParams.type = 'file';
    }
    // most of the work is done by getFiles. We just sort the results here.
    return getFiles(rootPath, searchParams)
        .then(fileList => {
            fileList.sort((a, b) => {
                if (a.mtime > b.mtime) {
                    return -1;
                }
                else if (a.mtime < b.mtime) {
                    return 1;
                }
                else {
                    return a.path.localeCompare(b.path);
                }
            });
            return fileList;
        })
        .catch((err) => {
            log('ERROR', 'An error occurred while searching for files', err);
            return [];
        });
};

module.exports = {
    getFiles: getFiles,
    fileExists: fileExists,
    move: move,
    search: search
};
