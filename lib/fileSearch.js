'use strict';

const fileManager = require('./fileManager');

/**
 * It should return every file that has * in its name, sorted by modification date in decending order (e.g. most recent on top).
 * It should return this as a list of file objects, as returned by the /list/ parameter.
 * It should search recursively through all of the user's files in their directory tree.
 */
const search = function(rootPath, query, includeFolders) {
    const searchParams = {
        query: query,
        deep: true
    };
    if (!includeFolders) {
        searchParams.type = 'file';
    }
    // most of the work is done by getFiles. We just sort the results here.
    return fileManager.getFiles(rootPath, searchParams)
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
            // log the error...
            console.error(err);
            return [];
        });
};

module.exports = search;
