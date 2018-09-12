'use strict';

const test = require('tape-async');
const log = require('lambda-log');

const DynDns = require('./dyndns');

// var credentials = new AWS.SharedIniFileCredentials({profile: 'dyndns'});
// AWS.config.credentials = credentials;

// Next statements are to ensure that all log messages are logged to stdout via console.log
// Default is to log error and warn to stderr
log.options.silent = true;
// eslint-disable-next-line no-console
const listener = message => { console.log(message.toJSON(log.options.dev)); };
log.on('log', listener);


test('listHostedZones returns full list', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    let zones = await dyndns.listHostedZones();
    t.equal(zones.length, 12, 'Hosted zones count');
    t.end();
});

log.off('log', listener);

