'use strict';

// usage: node get-token.js username password


var username = process.argv[2];
var password = process.argv[3];

var env = require('./config/env.json');
var config = require('./config/config-' + env.deployment + '.json');

var url = config.services.login.url;

var auth = require('./lib/auth').make({url: url, timeout: 10000});

var token = auth.getToken(username, password)
    .then(function (token) {
        var out = {
            token: token
        };
        process.stdout.write(JSON.stringify(out, null, 4));
    });
