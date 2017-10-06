/*global process*/
/*eslint white:true,node:true,single:true,multivar:true,es6:true*/

var fileManager = require('../lib/fileManager');

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

    it('Should shallow return local files', (done) => {
        fileManager.getFiles(testPath)
            .then((fileList) => {
                expect(fileList.length).toBe(3);
                expect(validateFileList(fileList)).toBe(true);
                done();
            });
    });

    it('Should deep return local files', (done) => {
        fileManager.getFiles(testPath, {deep: true})
            .then((fileList) => {
                expect(fileList.length).toBe(11);
                expect(validateFileList(fileList)).toBe(true);
                done();
            })
    });

    it('Should return only folders if that option is set', (done) => {
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

    it('Should return only folders if that option is set (recursive mode)', (done) => {
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

    it('Should return only files if that option is set', (done) => {
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

    it('Should return only files if that option is set (recursive mode)', (done) => {
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

});
