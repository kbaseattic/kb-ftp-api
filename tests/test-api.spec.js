/*global process*/
/*eslint white:true,node:true,single:true,multivar:true,es6:true*/
'use strict'

var r = require('request'),
    fs = require('fs')

var baseUrl = 'http://0.0.0.0:3000',
    token = fs.readFileSync('dev-user-token', 'utf8').trim();
console.log('\n\x1b[36m'+'using testing token:'+'\x1b[0m', token, '\n')

var url = path => baseUrl + path

var validAuthHeader = { 'Authorization': token }


describe('KBase FTP API GET Requests', () => {
    describe('GET /', () => {
        it('returns status code 404', done => {
            r.get({url: url('/')}, (error, response, body) => {
                expect(response.statusCode).toBe(404)
                done()
            })
        })
    })

    describe('GET /test-service', () => {
        it('returns status code 200 for /test-service', done => {
            r.get({url: url('/test-service')}, (error, response, body) => {
                expect(response.statusCode).toBe(200)
                done()
            })
        })
    })

    describe('GET /test-auth', () => {
        it('returns status code 500 for /test-auth with bad token', done => {
            r.get({url: url('/test-auth'), headers: {'Authorization': 'bad_token'}}, (error, response, body) => {
                expect(response.statusCode).toBe(500)
                done()
            })
        })

        it('returns status code 401 for /test-auth with no token', done => {
            r.get({url: url('/test-auth')}, (error, response, body) => {
                expect(response.statusCode).toBe(401)
                done()
            })
        })

        it('returns status code 200 for /test-auth with good token', done => {
            r.get({url: url('/test-auth'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200)
                done()
            })
        })
    })

    describe('GET /import-jobs', () => {
        it('returns current import-jobs, or an empty list', done => {
            r.get({url: url('/import-jobs'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(200)
                const res = JSON.parse(body)
                expect(res).toEqual({result: []})
                done()
            })
        })

        it('returns 401 without a token', done => {
            r.get({url: url('/import-jobs')}, (error, response, body) => {
                expect(response.statusCode).toBe(401)
                done()
            })
        })
    })

    describe('GET /import-job/:jobid', () => {
        it('returns 404 if parameter is missing', done => {
            r.get({url: url('/import-job'), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(404)
                done()
            })
        })

        it('returns 500 for invalid id', done => {
            const jobId = '123'
            r.get({url: url('/import-job/' + jobId), headers: validAuthHeader}, (error, response, body) => {
                expect(response.statusCode).toBe(500)
                const res = JSON.parse(body)
                done()
            })
        })
    })

    describe('GET /list', () => {

    })
})

describe('KBase FTP POST Requests', () => {
    describe('POST /upload', () => {

    })

    describe('POST /import-jobs', () => {

    })
})

describe('KBase FTP DELETE Requests', () => {
    describe('DELETE /import-job/:jobid', () => {

    })
})
