const pathUtil = require('path');

const isPathValid = function(path) {
    let testPath = path;
    if (testPath instanceof Array) {
        testPath = pathUtil.join(testPath);
    }
    testPath = pathUtil.normalize(testPath);

    if (testPath.startsWith('../')) {
        return false;
    }
    return true;
};

module.exports = {
    isPathValid: isPathValid
};
