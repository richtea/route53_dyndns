'use strict';

const test = require('tape-async');
const log = require('lambda-log');
const AWS = require('aws-sdk');

const DynDns = require('./dyndns');
const getSsmParams = require('./ssm-params');

log.options.debug = true;
// Next statements are to ensure that all log messages are logged to stdout via console.log
// Default is to log error and warn to stderr
log.options.silent = true;
// eslint-disable-next-line no-console
const listener = message => { console.log(message.toJSON(log.options.dev)); };
log.on('log', listener);

test('listHostedZones returns full list', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    let zones = await dyndns.listHostedZones();
    t.equal(zones.length, 15, 'Hosted zones count');
    t.end();
});

test('getSsmParams returns values', async (t) => {
    AWS.config.update({ region: 'eu-west-1' });
    let parms = await getSsmParams('dyndns-username', 'dyndns-password');
    t.equal(parms['dyndns-username'], 'dnsuser', 'Username');
    t.end();
});

test('findHostedZone finds zone', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    await dyndns.init();

    let zone = dyndns.findHostedZone('www.tebb.io.');
    t.equal(zone.Name, 'tebb.io.', 'Hosted Zone');
    t.end();
});

test('getResourceRecordsForZone returns record sets', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    await dyndns.init();

    let res = await dyndns.getResourceRecordSetForHost('/hostedzone/Z8G4XULSAYNO9', 'hanuman.tebb.io.');
    t.false(res.err, 'Error message');
    t.end();
});

test('getResourceRecordsForZone returns error if no host', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    await dyndns.init();

    let res = await dyndns.getResourceRecordSetForHost('/hostedzone/Z8G4XULSAYNO9', 'does-not-exist.tebb.io.');
    t.equal(res.err, 'No A records found for host', 'Error message');
    t.end();
});

test('update non-existent host', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    await dyndns.init();

    let res = await dyndns.update('does-not-exist.tebb.io.', '192.168.2.9');
    t.equal(res, `${DynDns.UPDATE_RESPONSES.NOHOST}`, 'Result');
    t.end();
});

test('update valid host', async (t) => {
    let dyndns = new DynDns({ region: 'eu-west-1' });
    await dyndns.init();

    let res = await dyndns.update('dyndnstest.tebbdev.net.', '192.168.2.9');
    t.equal(res, `${DynDns.UPDATE_RESPONSES.NOCHG} 192.168.2.9`, 'Result');
    t.end();
});

log.off('log', listener);
