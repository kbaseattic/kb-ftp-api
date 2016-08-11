var userIdRegex = /un=(\w+\@\w+(\.\w+))/;
var crypto = require("crypto");
var request = require('request');
var defer = require('promised-io/promise').defer;
var when = require("promised-io/promise").when;

var ss_cache = {};

getSigner = function(signer){
    var def = new defer();
    if (ss_cache[signer]){
        def.resolve(ss_cache[signer]);
    }
    request.get({url:signer,json:true}, function(err,response,body){
        if (err) { return def.reject(err); }
        if (!body) { return def.reject("Empty Signature"); }
        def.resolve(body.pubkey);
    });
    return def.promise;
}

var validateToken = function(token){
    var parts = token.split("|");
    var parsedToken = {}
    var baseToken = []
    parts.forEach(function(part){
        var tuple = part.split("=");
        if (tuple[0]!="sig"){
            baseToken.push(part);
        }
        parsedToken[tuple[0]]=tuple[1];
    });


    var ssString = parsedToken.SigningSubject,
    signingSubject = ssString.slice(0, ssString.lastIndexOf('/'));

    if (signingSubject !== "https://nexus.api.globusonline.org/goauth/keys") {
        return false;
    }


    return when(getSigner(parsedToken.SigningSubject), function(signer){
        var verifier = crypto.createVerify("RSA-SHA1");
        verifier.update(baseToken.join("|"));
        var success = verifier.verify(signer.toString("ascii"),parsedToken.sig,"hex")
        return success;
    }, function(err){
        console.log("Error retrieving SigningSubject: ", parsedToken.SigningSubject);
        return false;
    });

}

module.exports = function(token) {
    return when(validateToken(token), function(valid){
        if (!valid) {
            console.log("Invalid Token");
            return false;
        }

        var user = {id: token.split('|')[0].replace('un=', '')}

        console.log("User from token: ", user.id);
        if (user && user.id) {
            return user;
        }
        return false;
    });

}
