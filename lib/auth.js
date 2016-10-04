'use strict';
var request = require('request-promise');

function factory(config)  {
    var url = config.url,
        timeout = config.timeout || 60000;
    
    if (!url) {
        throw new TypeError('Auth login url is undefined');
    }

    function login(username, password) {
        var loginParams = {
            user_id: username,
            password: password,
            fields: 'un,token,user_id,kbase_sessionid,name',
            status: 1
        },
            data = Object.keys(loginParams).map(function (key) {
                return key + '=' + encodeURIComponent(loginParams[key]);
            }).join('&');

        var header = {};

        header['Content-type'] = 'application/x-www-form-urlencoded';

        return request({
            url: url,
            method: 'POST',
            headers: header,
            body: data
        })
            .then(function (body) {
                return JSON.parse(body);
            });
    }
    
    function getToken(username, password) {
        return login(username, password)
            .then(function(result) {
                return result.token;
            });
    }

    return {
        login: login,
        getToken: getToken
    };
}

module.exports = {
    make: function (config) {
        return factory(config);
    }
};