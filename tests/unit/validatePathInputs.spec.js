const validatePathInputs = require('../../lib/middlewares/validatePathInputs'),
      httpMocks = require('node-mocks-http');

describe('Test SanitizePathInputs middleware', () => {
    let genericRequest = httpMocks.createRequest(),
        genericResponse = httpMocks.createResponse();

    it('should accept valid path and call next', (done) => {
        let req = httpMocks.createRequest({
            params: ['foo/bar']
        });
        validatePathInputs(req, genericResponse, () => {
            done();
        });
    });

    it('should accept valid paths including ../', (done) => {
        let req = httpMocks.createRequest({
            params: ['foo/../bar/../baz']
        });
        validatePathInputs(req, genericResponse, () => {
            done();
        });
    });

    it('should reject paths that result in ../../some/path', (done) => {
        let req = httpMocks.createRequest({
            params: ['foo/../../../../bar']
        });
        validatePathInputs(req, genericResponse, () => {
            done();
        });
    })
});
