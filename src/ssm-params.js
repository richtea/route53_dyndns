'use strict';

const AWS = require('aws-sdk');

/**
 * Gets parameters from the AWS Parameter Store.
 *
 * @param  {...string} names The names of the parameters to retrieve.
 * @returns {Promise<any>} An object containing the parameters as properties and their values.
 */
async function getParams(...names) {
    let parms = {
        Names: names,
        WithDecryption: true
    };

    const ssm = new AWS.SSM();
    let req = ssm.getParameters(parms);
    let resp = await req.promise();

    let params = {};
    for (let p of resp.Parameters) {
        params[p.Name] = p.Value;
    }

    return params;
}

module.exports = getParams;
