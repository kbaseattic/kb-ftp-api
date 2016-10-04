'use strict';

function log(label, message, data) {
    console.log([new Date().toISOString(), label, message].join(':'), data ? JSON.stringify(data): '');
}

module.exports = {
    log: log
};