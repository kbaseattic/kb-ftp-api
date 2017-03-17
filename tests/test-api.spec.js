/*global process*/
/*eslint white:true,node:true,single:true,multivar:true,es6:true*/

var r = require('request'),
    fs = require('fs')

var baseUrl = "http://0.0.0.0:3000",
    token = fs.readFileSync('dev-user-token', 'utf8').trim();
console.log('\n\x1b[36m'+'using testing token:'+'\x1b[0m', token, '\n')


// var r = request.defaults()

var url = path => baseUrl + path

// var get = function(path,
//
//
//
// var get = request.defaults({
//     method: "GET",
//     headers: {
//         'Authorization': token.trim(),
//         'Content-type': 'application/json'
//     }
// })

// get /
// get test-service
// get test-auth
// get list
// post upload
// post import-jobs
// get import-jobs
// get import-job/:jobid
// delete import-job/:jobid


describe('KBase FTP API GET Requests', () => {
    describe('GET /', () => {
        it('returns status code 404', (done) => {
            r.get({url: url('/')}, (error, response, body) => {
                expect(response.statusCode).toBe(404)
                done()
            })
        })
    })

    describe('GET /test-service', () => {
        it('returns status code 200 for /test-service', (done) => {
            r.get({url: url('/test-service')}, (error, response, body) => {
                expect(response.statusCode).toBe(200)
                done()
            })
        })
    })

    describe('GET /test-auth', () => {
        it('returns status code 500 for /test-auth with bad token', (done) => {
            r.get({url: url('/test-auth'), headers: {'Authorization': 'bad_token'}}, (error, response, body) => {
                expect(response.statusCode).toBe(500)
                done()
            })
        })

        it('returns status code 401 for /test-auth with no token', (done) => {
            r.get({url: url('/test-auth')}, (error, response, body) => {
                expect(response.statusCode).toBe(401)
                done()
            })
        })

        it('returns status code 200 for /test-auth with good token', (done) => {
            r.get({url: url('/test-auth'), headers: {'Authorization': 'RD47QBVL2TEH64L4WIEV7LJ66F7EH2NM'}}, (error, response, body) => {
                expect(response.statusCode).toBe(200)
                done()
            })
        })
    })

    describe('GET /import-jobs', () => {

    })

    describe('GET /list', () => {

    })

    describe('GET /import-job/:id', () => {

    })
})
