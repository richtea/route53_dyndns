'use strict';

const log = require('lambda-log');

class Authorizer {
    constructor(config = {}) {
        this._username = config.username || 'admin';
        this._password = config.password || [...Array(10)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
    }

    authorize(event) {
        var authorizationHeader = event.headers.Authorization;

        if (!authorizationHeader) {
            log.info('Authorize: no Authorization header supplied');
            return false;
        }

        // Split on a space, the original auth looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
        let tmp = authorizationHeader.split(' ');
        let buf = Buffer.from(tmp[1], 'base64');
        let plainAuth = buf.toString();

        // At this point plain_auth = "username:password"

        let creds = plainAuth.split(':'); // split on a ':'
        let username = creds[0];
        let password = creds[1];

        if (username !== this._username) {
            log.info('Authorize: invalid username');
            return false;
        }

        if (password !== this._password) {
            log.info('Authorize: invalid password');
            return false;
        }

        return true;
    }
}

module.exports = Authorizer;
