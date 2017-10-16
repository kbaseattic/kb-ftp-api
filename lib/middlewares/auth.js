'use strict';
const Request = require('request-promise');

const getUserSession = function(authHost, token) {
    return Request({
        url: authHost + '/api/V2/me',
        method: 'GET',
        headers: {
            'Authorization': token
        }
    }).then(session => {
        session = JSON.parse(session);
        session.token = token;
        var globusUserIds = [];
        // find globus username(s) if any, and put *JUST THE USERNAME* in the globusUser key
        // otherwise, make it null
        session.idents.forEach(ident => {
            if (ident.provider === 'Globus') {
                globusUserIds.push(ident.username);
            }
        })
        session.globusUserIds = globusUserIds;
        return session;
    });
}

const authRequired = function(config, req, res, next) {
    // if no token at all, return 401
    if (!('authorization' in req.headers)) {
        res.status(401).send({error: 'Auth is required!'});
        return;
    }
    getUserSession(config.services.auth.url, req.headers.authorization)
    .then(sessionObj => {
        if (!sessionObj) {
            res.status(401).send({error: 'Invalid token!'});
            return;
        }

        // Pass user id along
        req.session = sessionObj;

        // safe to move along.
        next();
    }).catch(error => {
        res.status(500).send({error: 'Unable to validate authentication credentials'});
        return;
    });
}

/**
 * Wrap authRequired so it'll look like an Express middleware, but take a config input.
 */
module.exports = function(config) {
    return function(req, res, next) {
        return authRequired(config, req, res, next);
    }
};
