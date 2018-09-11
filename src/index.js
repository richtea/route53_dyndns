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
 */
async function initializeDependencies() {
    let config = { region: process.env.AWS_REGION };
    var dd = new DynDns(config);
    return Promise.resolve({ DynDns: dd });
}

/**
 * Handles a dyndns update event.
 * 
 * @param {object} event The AWS lambda event.
 * @param {object} deps The dependencies object.
 * @returns {object} The AWS proxy response (see https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-output-format)
 */
function handleEvent(event, deps) {
    let hostname = '', myip = '';
    if (event.queryStringParameters.hostname) {
        hostname = event.queryStringParameters.hostname;
    }
    else {
        throw createError(400, 'notfqdn');
    }
    if (event.queryStringParameters.myip) {
        myip = event.queryStringParameters.myip;
    }
    else {
        throw createError(400, 'fatal Parameter myip not specified');
    }
    
    deps.DynDns.update(hostname, myip);

    var responseBody = 'All good';
    var response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify(responseBody),
        isBase64Encoded: false
    };
    return response;
}

module.exports.deps = initializeDependencies;
module.exports.handler = handler;

