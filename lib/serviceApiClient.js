'use strict';
var request = require('request-promise');

function factory(config)  {
    var url = config.url,
        servicePrefix = config.name,
        authToken = config.token,
        timeout = config.timeout || 60000;
    
    if (!url) {
        throw new TypeError('Service url is undefined');
    }
    if (!servicePrefix) {
        throw new TypeError('Service name is undefined');
    }

    function rpcRequest(method, params) {
        var rpc = {
            params: params,
            method: servicePrefix + '.' + method,
            version: "1.1",
            id: String(Math.random()).slice(2)
        };

        var header = {};
        if (authToken) {
            header.Authorization = authToken;
        }

        header['Content-type'] = 'application/x-www-form-urlencoded';

        return request({
            url: url,
            method: 'POST',
            headers: header,
            body: JSON.stringify(rpc)
        })
            .then(function (body) {
                try {
                    // console.log('body', body);
                    var data = JSON.parse(body);
                    if (data && data instanceof Object && data !== null) {
                        var result = data.result;
                        if (result && result instanceof Array) {
                            return result[0];
                        }
                        return result;
                    }
                    throw new Error('Error with result format for ' + servicePrefix + ', ' + method + ', ' + body);
                } catch (ex) {
                    throw new Error('Error parsing result for ' + servicePrefix + ', ' + method + ', ' + body + ':' + ex.message);
                }
            });
    }

    return {
        rpcRequest: rpcRequest
    };
}

module.exports = {
    make: function (config) {
        return factory(config);
    }
};