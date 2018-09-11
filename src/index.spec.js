'use strict';

const test = require('tape-async');
const sinon = require('sinon');
const log = require('lambda-log');

const DynDns = require('./dyndns');
const sut = require('./index');

// Next statements are to ensure that all log messages are logged to stdout via console.log
// Default is to log error and warn to stderr
log.options.silent = true;
// eslint-disable-next-line no-console
log.on('log', message => { console.log(message.toJSON(log.options.dev)); });

test('missing hostname parameter returns notfqdn error', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return DynDns.UPDATE_RESPONSES.GOOD; });

    const deps = { DynDns: dyndns };
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            myip: '172.168.2.3'
        }
    };

    let callback = sinon.spy();

    await sut.handler(event, {}, callback);

    t.equal(callback.callCount, 1, 'Callback count');
    let res = callback.getCall(0).args[1];
    if (!res) {
        t.fail('No result from update');
    }

    t.equal(res.statusCode, 400, 'HTTP status code');
    t.equal(res.body, 'notfqdn', 'Error message');

    t.end();
});

test('update on changed host returns good result', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return DynDns.UPDATE_RESPONSES.GOOD; });

    const deps = { DynDns: dyndns };
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            hostname: 'www.example.com',
            myip: '172.168.2.3'
        }
    };

    let callback = sinon.spy();

    await sut.handler(event, {}, callback);

    t.equal(callback.callCount, 1, 'Callback count');
    let res = callback.getCall(0).args[1];
    if (!res) {
        t.fail('No result from update');
    }

    t.equal(res.statusCode, 200, 'HTTP status code');
    t.equal(res.body, 'good 172.168.2.3', 'body');
    t.end();
});

test('update on unchanged host returns nochg result', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return DynDns.UPDATE_RESPONSES.NOCHG; });

    const deps = { DynDns: dyndns };
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            hostname: 'www.example.com',
            myip: '172.168.2.3'
        }
    };

    let callback = sinon.spy();

    await sut.handler(event, {}, callback);
    t.equal(callback.callCount, 1, 'Callback count');
    let res = callback.getCall(0).args[1];
    if (!res) {
        t.fail('No result from update');
    }

    t.equal(res.statusCode, 200, 'HTTP status code');
    t.equal(res.body, 'nochg 172.168.2.3', 'body');
    t.end();
});