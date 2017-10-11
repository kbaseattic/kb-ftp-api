'use strict';
const Request = require('request-promise'),
      log = require('../utils/log'),
      pathUtil = require('path');

/**
 * Standard Expressjs nomenclature for middlewares. next = callback function.
 * looks at req.param[0], assumes that's the whole of the path, then normalizes.
 * if it starts with ./, it's fine. If it starts with ../, then reject with
 * a 403.
 */
const sanitizePathInputs = function(req, res, next) {
    const path = pathUtil.normalize(req.params[0]);
    if (path.startsWith('../')) {
        log('ERROR', 'User attempted to access path ' + req.params[0], req);
        res.status(403).send('../ not allowed as a path prefix');
    }
    next();
}

module.exports = sanitizePathInputs;
