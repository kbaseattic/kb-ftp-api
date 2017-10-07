/*global process*/
/*eslint white:true,node:true,single:true,multivar:true,es6:true*/

var fileManager = require('../lib/fileManager'),
    search = require('../lib/fileSearch'),
    pathUtil = require('path'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs'));

describe('Test fileManager module', () => {
    let testPath = './tests/data';

    /**
     * Expects a list of "file" objects. Each object should have the following kvps:
     * name: string,
     * path: string starting with "tests/data",
     * mtime: number,
     * size: number,
     * isFolder: boolean
     *
     * returns true if all objects in the list contain those keys, false otherwise
     */
    const validateFileList = function(fileList) {
        const template = {
            name: 'string',
            path: 'string',
            mtime: 'number',
            size: 'number',
            isFolder: 'boolean'
        };
        let validation = true;
        fileList.forEach((file) => {
            Object.keys(template).forEach((key) => {
                if (!key in file || typeof file[key] !== template[key]) {
                    validation = false;
                }
            });
        });
        return validation;
    }

    /**
     * Implicit in these tests is ignoring the given .globus_id file in root of testPath.
     */

    it('getFiles should shallow return local files', (done) => {
        fileManager.getFiles(testPath)
            .then((fileList) => {
                expect(fileList.length).toBe(3);
                expect(validateFileList(fileList)).toBe(true);
                done();
            });
    });

    it('getFiles should deep return local files', (done) => {
        fileManager.getFiles(testPath, {deep: true})
            .then((fileList) => {
                expect(fileList.length).toBe(11);
                expect(validateFileList(fileList)).toBe(true);
                done();
            })
    });

    it('getFiles should return only folders if that option is set', (done) => {
        fileManager.getFiles(testPath, {type: 'folder'})
            .then((fileList) => {
                expect(fileList.length).toBe(2);
                expect(validateFileList(fileList)).toBe(true);
                fileList.forEach((file) => {
                    expect(file.isFolder).toBe(true);
                });
                done();
            });
    });

    it('getFiles should return only folders if that option is set (recursive mode)', (done) => {
        fileManager.getFiles(testPath, {type: 'folder', deep: true})
            .then((fileList) => {
                expect(fileList.length).toBe(5);
                expect(validateFileList(fileList)).toBe(true);
                fileList.forEach((file) => {
                    expect(file.isFolder).toBe(true);
                });
                done();
            });
    });

    it('getFiles should return only files if that option is set', (done) => {
        fileManager.getFiles(testPath, {type: 'file'})
            .then((fileList) => {
                expect(fileList.length).toBe(1);
                expect(validateFileList(fileList)).toBe(true);
                fileList.forEach((file) => {
                    expect(file.isFolder).toBe(false);
                });
                done();
            });
    });

    it('getFiles should return only files if that option is set (recursive mode)', (done) => {
        fileManager.getFiles(testPath, {type: 'file', deep: true})
            .then((fileList) => {
                expect(fileList.length).toBe(6);
                expect(validateFileList(fileList)).toBe(true);
                fileList.forEach((file) => {
                    expect(file.isFolder).toBe(false);
                });
                done();
            });
    });

    it('getFiles should return files / directories that match a query (recursive mode)', (done) => {
        const query = 'deepest';
        fileManager.getFiles(testPath, {deep: true, query: query})
            .then((fileList) => {
                expect(fileList.length).toBe(2);
                expect(validateFileList(fileList)).toBe(true);
                fileList.forEach((file) => {
                    expect(file.path.indexOf(query)).toBeGreaterThan(-1);
                });
                done();
            });
    });

    it('getFiles should throw an error if the root dir doesn\'t exist', (done) => {
        fileManager.getFiles('not_a_path')
            .then((fileList) => {
                fail('getFiles should raise a ENOENT error with a bad path');
            })
            .catch((err) => {
                expect(err.code).toBe('ENOENT');
            })
            .finally(() => {
                done();
            });
    });

    it('fileExists should return true for a real directory', (done) => {
        fileManager.fileExists(testPath).then((exists) => {
            expect(exists).toBe(true);
            done();
        });
    });

    it('fileExists should return true for a real file', (done) => {
        fileManager.fileExists(pathUtil.join(testPath, 'test_data_file.txt')).then((exists) => {
            expect(exists).toBe(true);
            done();
        });
    });

    it('fileExists should return false for a fake path', (done) => {
        fileManager.fileExists('not_a_path').then((exists) => {
            expect(exists).toBe(false);
            done();
        });
    });

    it('move should successfully move a file from one place to another', (done) => {
        // create a file in one place.
        let startPath = pathUtil.join(testPath, 'tmp.txt');
        let endPath = pathUtil.join(testPath, 'tmp-moved.txt');
        fs.writeFile(startPath, 'just a test!');

        // move it.
        fileManager.move(startPath, endPath).then(() => {
            // make sure it's no longer in the first place
            return fileManager.fileExists(startPath);
        }).then((exists) => {
            expect(exists).toBe(false);
            // make sure it's in the second.
            return fileManager.fileExists(endPath);
        }).then((exists) => {
            expect(exists).toBe(true);
            // delete it.
            fs.unlink(endPath);
        }).catch((err) => {
            // on error, try to delete both
            console.error(err);
            fs.unlink(startPath);
            fs.unlink(endPath);
        }).finally(() => {
            done();
        });
    });

    xit('search should find and return files only', (done) => {
        search(testPath, 'deep', false).then(results => {
            expect(results.length).toBe(5);
            done();
        });
    });

    xit('search should find and return files AND directories', (done) => {
        search(testPath, 'deep', true).then(results => {
            expect(results.length).toBe(10);
            done();
        });
    });

    xit('search should return an empty array with no hits', (done) => {
        search(testPath, 'foobarbaz', true).then(results => {
            expect(results.length).toBe(0);
            done();
        });
    });

    xit('searching from a root dir that doesn\'t exist should return an empty array', (done) => {
        search('not_real', 'still_not_real').then(results => {
            expect(results.length).toBe(0);
            done();
        });
    });

    it('search should not include any terms that live on the path behind the root', (done) => {
        search(testPath, 'tests').then(results => {
            expect(results.length).toBe(0);
            done();
        });
    });

});
