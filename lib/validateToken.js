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
        var globusUserIds = []
        // find globus username(s) if any, and put *JUST THE USERNAME* in the globusUser key
        // otherwise, make it null
        session.idents.forEach(ident => {
            if (ident.provider === 'Globus') {
                globusUserIds.push(ident.username)
            }
        })
        session.globusUserIds = globusUserIds
        return session
    })
}

module.exports = function(authHost, token) {
    return getUserSession(authHost, token)
}
