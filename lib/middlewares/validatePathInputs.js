'use strict';
const log = require('../utils/log'),
      validator = require('../utils/validators'),
      pathUtil = require('path');

/**
 * Standard Expressjs nomenclature for middlewares. next = callback function.
 * looks at req.param[0], assumes that's the whole of the path, then normalizes.
 * if it starts with ./, it's fine. If it starts with ../, then reject with
 * a 403.
 *
 * This also gets used in the POST for uploading. If that has a bad destPath,
 * also reject.
 */
const validatePathInputs = function(req, res, next) {
    let testPath = req.params[0];
    if (validator.isPathValid(testPath)) {
        next();
    }
    else {
        log('ERROR', 'User attempted to access path ' + normalPath);
        res.status(403).send('Unallowed path: ' + testPath);
    }
}

module.exports = validatePathInputs;
