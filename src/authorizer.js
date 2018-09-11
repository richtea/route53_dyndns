'use strict';
const log = require('lambda-log');

class Authorizer {

    authorize(event) {
        var authorizationHeader = event.headers.Authorization;
    
        if (!authorizationHeader) {
            return false;
        }
    
        var encodedCreds = authorizationHeader.split(' ')[1];
        var plainCreds = (new Buffer(encodedCreds, 'base64')).toString().split(':');
        var username = plainCreds[0];
        var password = plainCreds[1];
    
        if (!(username === 'admin' && password === 'secret')) {
            return false;
        }
    
        return true;
    }
}

module.exports = Authorizer;