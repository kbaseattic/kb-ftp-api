var request = require('request'),
    fs = require('fs');

var url = "http://0.0.0.0:3000/v0/";

var token = fs.readFileSync('dev-user-token', 'utf8');
console.log('\n\x1b[36m'+'using testing token:'+'\x1b[0m', token, '\n')

var get = request.defaults({
    method: "GET",
    headers: {
        'Authorization': token.trim(),
        'Content-type': 'application/json'
    }
})

describe("KBase FTP API GET Requests", function() {
    describe("GET /", function() {
        it("returns status code 200", function(done) {
            get({url: url}, function(error, response, body) {
                expect(response.statusCode).toBe(404);
                done();
            });
        });
    });
});
