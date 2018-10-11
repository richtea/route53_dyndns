'use strict';

const test = require('tape-async');
const sinon = require('sinon');
const log = require('lambda-log');

const DynDns = require('./dyndns');
const Authorizer = require('./authorizer');
const sut = require('./index');

// Next statements are to ensure that all log messages are logged to stdout via console.log
// Default is to log error and warn to stderr
log.options.silent = true;
// eslint-disable-next-line no-console
const listener = message => { console.log(message.toJSON(log.options.dev)); };
log.on('log', listener);

const defaultEvent = {
    queryStringParameters: {
        hostname: 'www.example.com',
        myip: '172.168.2.3'
    },
    headers: {
        Authorization: 'Basic xyzzy'
    }
};

var defaultAuthorizer = new Authorizer();
sinon.stub(defaultAuthorizer, 'authorize').callsFake(() => true);

// Default dependencies
var defaultDeps = { Authorizer: defaultAuthorizer };

test('missing hostname parameter returns notfqdn error', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return Promise.resolve(DynDns.UPDATE_RESPONSES.GOOD); });

    const deps = Object.assign({ DynDns: dyndns }, defaultDeps);
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            myip: '172.168.2.3'
        },
        headers: {
            Authorization: 'Basic xyzzy'
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
    sinon.stub(dyndns, 'update').callsFake(() => { return Promise.resolve(`${DynDns.UPDATE_RESPONSES.GOOD} 172.168.2.3`); });

    const deps = Object.assign({ DynDns: dyndns }, defaultDeps);
    sut.deps = () => { return Promise.resolve(deps); };

    let callback = sinon.spy();

    await sut.handler(defaultEvent, {}, callback);

    t.equal(callback.callCount, 1, 'Callback count');
    let res = callback.getCall(0).args[1];
    if (!res) {
        t.fail('No result from update');
    }

    t.equal(res.statusCode, 200, 'HTTP status code');
    t.equal(res.body, 'good 172.168.2.3\n', 'body');
    t.end();
});

test('update on unchanged host returns nochg result', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return Promise.resolve(DynDns.UPDATE_RESPONSES.NOCHG); });

    const deps = Object.assign({ DynDns: dyndns }, defaultDeps);
    sut.deps = () => { return Promise.resolve(deps); };

    let callback = sinon.spy();

    await sut.handler(defaultEvent, {}, callback);
    t.equal(callback.callCount, 1, 'Callback count');
    let res = callback.getCall(0).args[1];
    if (!res) {
        t.fail('No result from update');
    }

    t.equal(res.statusCode, 200, 'HTTP status code');
    t.equal(res.body, 'nochg 172.168.2.3\n', 'body');
    t.end();
});

test('update on invalid FQDN host returns notfqdn result', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return Promise.resolve(DynDns.UPDATE_RESPONSES.NOCHG); });

    const deps = Object.assign({ DynDns: dyndns }, defaultDeps);
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            hostname: 'www*.example.com',
            myip: '172.168.2.3'
        },
        headers: {
            Authorization: 'Basic xyzzy'
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
    t.equal(res.body, 'notfqdn\n', 'body');
    t.end();
});

test('update on multiple hosts returns multiple results', async (t) => {
    let dyndns = new DynDns();
    sinon.stub(dyndns, 'update').callsFake(() => { return Promise.resolve(`${DynDns.UPDATE_RESPONSES.GOOD} 172.168.2.3`); });

    const deps = Object.assign({ DynDns: dyndns }, defaultDeps);
    sut.deps = () => { return Promise.resolve(deps); };

    const event = {
        queryStringParameters: {
            hostname: 'www.example.com, www.example.org, *invalid',
            myip: '172.168.2.3'
        },
        headers: {
            Authorization: 'Basic xyzzy'
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
    t.equal(res.body, 'good 172.168.2.3\ngood 172.168.2.3\nnotfqdn\n', 'body');
    t.end();
});
