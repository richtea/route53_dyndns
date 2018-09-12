'use strict';
const log = require('lambda-log');
const createError = require('http-errors');

const DynDns = require('./dyndns');


async function handler (event, context, callback) {
    try {
        log.info('Hello, world! We are in AWS_REGION ' + process.env.AWS_REGION);
        
        const deps = await module.exports.deps();

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
async function initializeDependencies() {
    let config = { region: process.env.AWS_REGION };
    var dd = new DynDns(config);
    return dd.init().then(() => { return { DynDns: dd }; });
}

/**
 * Extracts the query string parameters from the lambda event.
 * 
 * @param {Object} event The AWS Lambda event.
 * @returns {Object} An object containing hostnames and myip properties.
 */
function getParams(event) {
    let hostname = idx(event, _ => _.queryStringParameters.hostname);
    if (!hostname) {
        throw createError(400, 'notfqdn');
    }

    let myip = idx(event, _ => _.queryStringParameters.myip);
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

function idx(input, accessor) {
    try {
        return accessor(input);
    } catch (e) {
        return undefined;
    }
}

/**
 * Handles a dyndns update event.
 * 
 * @param {object} event The AWS lambda event.
 * @param {object} deps The dependencies object.
 * @returns {object} The AWS proxy response (see https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format)
 */
async function handleEvent(event, deps) {

    let { hostnames, myip } = getParams(event);

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

