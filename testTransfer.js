var transferClient = require('./lib/globusTransfer');

var authToken = '';

var transferToken = '';

// get the endpoint id

// sharing endpoint
var endpointId = '';

var auth_service = 'https://auth.globus.org';
var transfer_service = 'https://transfer.api.globusonline.org/v0.10';
var nexus_service = 'https://nexus.api.globusonline.org';


var client = transferClient.make({
    authApiBase: auth_service,
    transferApiBase: transfer_service,
    authToken: authToken,
    transferToken: transferToken,
    endpointId: endpointId
});

var testuser = 'eaptest31';

client.getUserIdentityId(testuser)
    .then(function (result) {
        console.log(result);
    })
    .catch(function (err) {
            console.log('ERROR', err);
    });
    
client.addUserShare(testuser, '/data/bulk')
// client.getAccessList().then(function (result) {console.log(result)});