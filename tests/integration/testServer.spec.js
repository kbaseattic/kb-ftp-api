/*global process*/
/*eslint white:true,node:true,single:true,multivar:true,es6:true*/
'use strict';

const r = require('request'),
      fs = require('fs')

let baseUrl = 'http://0.0.0.0:3000',
    token = null,
    testUser = null;

try {
    var testConfig = JSON.parse(fs.readFileSync('tests/test-cfg.json', 'utf8'));
    token = testConfig.authToken;
    if (token === null || token === undefined) {
        throw new Error("Your test-cfg.json file must have a valid authToken value.");
    }
    testUser = testConfig.userId;
    if (testUser === null || testUser === undefined) {
        throw new Error("Your test-cfg.json file must have a valid user id.");
    }
} catch (e) {
    if (e.code === "ENOENT") {
        console.error("There needs to be a test-cfg.json file with authToken and userId keys.");
    }
    else {
        console.error(e);
    }
    console.error("Please see README.md for details.");
    process.exit(1);
}

console.log('\n\x1b[36m'+'using testing token:'+'\x1b[0m', token);
console.log('\n\x1b[36m'+'using test user:'+'\x1b[0m', testUser);

var url = path => baseUrl + path;

var validAuthHeader = { 'Authorization': token };


describe('KBase FTP API GET Requests', () => {
    describe('GET /', () => {
        it('returns status code 404', (done) => {
            r.get({url: url('/')}, (error, response, body) => {
                expect(response.statusCode).toBe(404);
                done();
            });
        });
    });

    describe('GET /test-service', () => {
        it('returns status code 200 for /test-service', (done) => {
            r.get({url: url('/test-service')}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                done();
            });
        });
    });

    describe('GET /test-auth', () => {
        it('returns status code 500 for /test-auth with bad token', (done) => {
            r.get({url: url('/test-auth'), headers: {'Authorization': 'bad_token'}}, (error, response, body) => {
                expect(response.statusCode).toBe(500);
                done();
            });
        });

        it('returns status code 401 for /test-auth with no token', (done) => {
            r.get({url: url('/test-auth')}, (error, response, body) => {
                expect(response.statusCode).toBe(401);
                done();
            });
        });

        it('returns status code 200 for /test-auth with good token', (done) => {
            r.get({url: url('/test-auth'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                done();
            });
        });
    });

    describe('GET /import-jobs', () => {
        it('returns current import-jobs, or an empty list', (done) => {
            r.get({url: url('/import-jobs'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                const res = JSON.parse(body);
                expect(res.result).toEqual(jasmine.any(Array));
                done();
            });
        });

        it('returns 401 without a token', (done) => {
            r.get({url: url('/import-jobs')}, (error, response, body) => {
                expect(response.statusCode).toBe(401);
                done();
            });
        });
    });

    describe('GET /import-job/:jobid', () => {
        it('returns 404 if parameter is missing', (done) => {
            r.get({url: url('/import-job'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(404);
                done();
            });
        });

        it('returns 500 for invalid id', (done) => {
            const jobId = '123';
            r.get({url: url('/import-job/' + jobId), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(500);
                const res = JSON.parse(body);
                done();
            });
        });
    });

    describe('GET /list', () => {
        it('returns 401 with missing auth headers', (done) => {
            r.get({url: url('/list/' + testUser)}, (error, response, body) => {
                expect(response.statusCode).toBe(401);
                done();
            });
        });

        it('returns 403 with token/path root name mismatch', (done) => {
            r.get({url: url('/list/notauser'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(403);
                done();
            });
        });

        it('returns 404 with missing path', (done) => {
            r.get({url: url('/list'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(404);
                done();
            });
        });

        it('returns a list of files with proper path', (done) => {
            const keyList = ['name', 'path', 'mtime', 'isFolder', 'size'].sort()
            r.get({url: url('/list/' + testUser), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                const result = JSON.parse(body);
                expect(result).toEqual(jasmine.any(Array));
                // don't really care about contents, but make sure keys are there
                result.forEach(item => {
                    expect(Object.keys(item).sort()).toEqual(keyList);
                });
                done();
            });
        });
    });

    describe('GET /search', () => {
        it('returns 401 with missing auth headers', (done) => {
            r.get({url: url('/search/' + testUser)}, (error, response, body) => {
                expect(response.statusCode).toBe(401);
                done();
            });
        });

        it('returns 200 and empty search results', (done) => {
            r.get({url: url('/search/omgwtfbbq'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                expect(JSON.parse(body).length).toEqual(0);
                done();
            });
        });

        it('returns 200 and valid search results', (done) => {
            r.get({url: url('/search/1'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200);
                expect(JSON.parse(body).length).toBeGreaterThan(0);
                done();
            });
        });
    });
});

describe('KBase FTP POST Requests', () => {
    describe('POST /upload', () => {
        it('Should work on the happy path for a simple file', (done) => {
            var formData = {
                destPath: '/' + testUser,
                username: testUser,
                uploads: [
                    fs.createReadStream('./tests/data/test_data_file.txt')
                ]
            };
            r.post({url: url('/upload'),
                    headers: validAuthHeader,
                    formData: formData},
                    (error, response, body) => {
                expect(response.statusCode).toBe(200);
                console.log(body);
                const result = JSON.parse(body);
                expect(result.length).toBe(1);
                var resultKeys = ['path', 'name', 'size', 'mtime'].sort();
                expect(Object.keys(result[0]).sort()).toEqual(resultKeys);
                done();
            });
        });
    });

    describe('POST /import-jobs', () => {

    });
});

describe('KBase FTP DELETE Requests', () => {
    describe('DELETE /import-job/:jobid', () => {

    });

    describe('DELETE /file/*', () => {
        it('returns 200 when deleting an existing file', (done) => {
            done();
        });
    });
});
