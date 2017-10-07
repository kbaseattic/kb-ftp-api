var request = require('request-promise');
var utils = require('./utils');

/*
 * Provides methods for sharing a directory per user over globus transfer
 */

// given a "super user" for whom the endpoint client is already running
// identified by an authToken (to fetch a user's identity)
// and a transferToken (to set up the permissions on the directory) ...

// get the tokens
// TODO: get from config



// get the userId of the user for whom the share is created
// this is the same as a kbase username

// get the identity id of the userId from globus. This is
// just a check to ensre that his a valid user...
// but this should not really be necessary since the share
// should fail if the user is not valid.
// TODO perhaps implement this, but I don't think necessary.

// call the add_endpoint_acl_rul with the given
// endpoint, userId, path, etc.

/* https://docs.globus.org/api/transfer/acl/
 * section 7.3:
 *
 * POST /endpoint/<endpoint_xid>/access
 *
 */

/*
 * nb globus embeds these urls in their example source code. That is
 * part of their "magic". However, we dont' do that.
 * https://github.com/globus/globus-sdk-python/blob/master/globus_sdk/globus.cfg
 */

function factory(config) {
    'use strict';
    var transferApiBase = config.transferApiBase,
        authApiBase = config.authApiBase,
        authToken = config.authToken,
        transferToken = config.transferToken,
        endpointId = config.endpointId;

    function getUserIdentityId(username) {
        var globusId = username + '@globusid.org',
            url = [authApiBase, 'v2', 'api', 'identities'].join('/'),
            query = {
                usernames: globusId
            },
            header = {
                Authorization: 'Bearer ' + authToken
            };
        return request({
            method: 'GET',
            url: url,
            qs: query,
            headers: header
        })
            .then(function (response) {
                utils.log('INFO', `successfully fetched identity for ${username}`)
                var result = JSON.parse(response);
                return result.identities[0].id;
            });
    }

    function getRoles() {
        var url = [transferApiBase, 'endpoint', endpointId, 'role_list'].join('/'),
            header = {
                Authorization: 'Bearer ' + transferToken,
                'Content-Type': 'application/json'
            };
        return request({
            method: 'GET',
            url: url,
            headers: header
        });
    }

    function getAccessList() {
        var url = [transferApiBase, 'endpoint', endpointId, 'access_list'].join('/'),
            header = {
                Authorization: 'Bearer ' + transferToken,
                'Content-Type': 'application/json'
            };
        return request({
            method: 'GET',
            url: url,
            headers: header
        });
    }

    function addUserShare(username, path) {
        var url = [transferApiBase, 'endpoint', endpointId, 'access'].join('/'),
            header = {
                Authorization: 'Bearer  ' + transferToken,
                'Content-Type': 'application/json'
            },
            data = {
                DATA_TYPE: 'access',
                principal_type: 'identity',
                path: ['', username, ''].join('/'),
                permissions: 'rw'
            };
        return getUserIdentityId(username)
            .then(function (userIdentityId) {
                data.principal = userIdentityId;
                return request({
                    method: 'POST',
                    url: url,
                    headers: header,
                    body: JSON.stringify(data)
                });
            })
            .then(function (result) {
                utils.log('INFO', `Successfully added user share for ${username}`);
                return result;
            })
            .catch(function (err) {
                // handle error conditions as per the spec:
                // rethrow as specific errors.
                // console.log('ERROR', err);
                utils.log('ERROR', 'error adding user share', err);
                throw err;
            });
    }

    return Object.freeze({
        getUserIdentityId: getUserIdentityId,
        addUserShare: addUserShare,
        getRoles: getRoles,
        getAccessList: getAccessList
    });
}


module.exports = {
    make: function (config) {
        'use strict';
        return factory(config);
    }
};
