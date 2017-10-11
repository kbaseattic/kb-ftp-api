'use strict';

const config = require('../../config/config-test.json'),
      httpMocks = require('node-mocks-http'),
      AuthRequired = require('../../lib/middlewares/auth')(config);

describe('Test AuthRequired middleware', () => {
    it('', (done) => {
        let req = httpMocks.createRequest(),
            res = httpMocks.createResponse();
        // AuthRequired(req, res, () => { done(); });
        done();
    });
});
