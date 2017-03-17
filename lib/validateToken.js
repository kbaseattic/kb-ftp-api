'use strict'

var Request = require('request-promise')
/**
 * Given an auth token, fetch the user session information from
 * the Auth service.
 */
var getUserSession = function(authHost, token) {
    return Request({
        url: authHost + '/api/V2/me',
        method: 'GET',
        headers: {
            'Authorization': token
        }
    }).then(session => {
        session = JSON.parse(session)
        session.token = token
        return session
    })
}

module.exports = function(authHost, token) {
    return getUserSession(authHost, token)
}
