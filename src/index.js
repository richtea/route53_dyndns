'use strict';
const log = require('lambda-log');
const createError = require('http-errors');

const utils = require('./utils');
const DynDns = require('./dyndns');
const getSsmParams = require('./ssm-params');
const Authorizer = require('./authorizer');


async function handler (event, context, callback) {
    try {
        if (utils.idx(event, _ => _.stageVariables.LogDebug)) {
            log.options.debug = true;
            log.debug('Debug log enabled');
        }
        
        const deps = await module.exports.deps(event);

        const response = await handleEvent(event, deps);
        callback(null, response);
    }
    catch(ex) {
        log.error(ex);
        const err = {
            statusCode: 500,
            body: 'Internal server error',
            isBase64Encoded: false
        };

        if (ex instanceof createError.HttpError) {
            err.statusCode = ex.statusCode;
            err.body = ex.message;
        }

        if (ex instanceof createError.Unauthorized) {
            err.headers = { 'WWW-Authenticate': 'Basic realm="DynDns API"' };
        }

        callback(null, err);
    }
    
}

/**
 * Called to initialize external dependencies - a very simple form of dependency injection
 * to enable mocking for unit tests.
 * 
 * See https://www.ceilfors.com/2017/12/03/dependency-injection-in-aws-lambda-nodejs.html
 * 
 * @returns {Object} An object containing the initialized dependencies.
 */
async function initializeDependencies(event) {
    let ddconfig = { region: process.env.AWS_REGION };
    let dd = new DynDns(ddconfig);
    let ddinit = dd.init();

    let usernameParm = utils.idx(event, _ => _.stageVariables.UsernameParm) || 'dyndns-username';
    let passwordParm = utils.idx(event, _ => _.stageVariables.PasswordParm) || 'dyndns-password';
    log.debug(`Using SSM parameters (${usernameParm}) for username and (${passwordParm}) for password`);

    let getParms = getSsmParams(usernameParm, passwordParm);

    let [, parms] = await Promise.all([ddinit, getParms]);

    let azconfig = {username: parms[usernameParm], password: parms[passwordParm] };
    let az = new Authorizer(azconfig);

    return { DynDns: dd, Authorizer: az };
}

/**
 * Extracts the query string parameters from the lambda event.
 * 
 * @param {Object} event The AWS Lambda event.
 * @returns {Object} An object containing hostnames and myip properties.
 */
function getEventParams(event) {
    let hostname = utils.idx(event, _ => _.queryStringParameters.hostname);
    if (!hostname) {
        throw createError(400, 'notfqdn');
    }

    let myip = utils.idx(event, _ => _.queryStringParameters.myip);
    if (!myip) {
        throw createError(400, 'fatal Parameter myip not specified');
    }
 
    let hostnames = hostname.split(',');
    if(hostnames.length > 20) {
        throw createError(400, 'numhost');
    }

    hostnames.forEach((o, i, arr) => arr[i] = o.trim());

    return { hostnames, myip };
}

/**
 * Handles a dyndns update event.
 * 
 * @param {object} event The AWS lambda event.
 * @param {object} deps The dependencies object.
 * @returns {object} The AWS proxy response (see https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format)
 */
async function handleEvent(event, deps) {

    // If no auth header, throw
    if (!utils.idx(event, _ => _.headers.Authorization)) {
        throw createError(401, 'Unauthorized');
    }

    // Authorize user from header
    if (!deps.Authorizer.authorize(event)) {
        throw createError(403, 'Forbidden');
    }

    let { hostnames, myip } = getEventParams(event);

    let results = new Map();
    
    for (let host of hostnames) {
        let result;
        // Test that host is a well-formed FQDN
        if (/(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/.test(host)) {
            result = await deps.DynDns.update(host, myip);
        } else {
            result = DynDns.UPDATE_RESPONSES.NOTFQDN;
        }
        
        results.set(host, { result });
    }
    
    let responseBody = '';
    for (let v of results.values()) { 
        if (v.result == DynDns.UPDATE_RESPONSES.GOOD || v.result == DynDns.UPDATE_RESPONSES.NOCHG) {
            responseBody += `${v.result} ${myip}` + '\n';
        } else {
            responseBody += v.result + '\n';
        }
    }

    var response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
        body: responseBody,
        isBase64Encoded: false
    };
    return response;
}

module.exports.deps = initializeDependencies;
module.exports.handler = handler;

