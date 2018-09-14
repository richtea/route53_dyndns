'use strict';
const log = require('lambda-log');
const AWS = require('aws-sdk');

/*
const util = require('util');

*/

const UPDATE_RESPONSES = {
    GOOD: 'good',       // Updated successfully
    NOCHG: 'nochg',     // No change to the ip address was required
    NOHOST: 'nohost',   // Host not found
    NOTFQDN: 'notfqdn'  // Not a valid FQDN
};

class DynDns {
    constructor(config = {}) {
        // Make a deep copy of the config object - asssumes it is simple JS object with
        // no functions etc. 
        this._config = JSON.parse(JSON.stringify(config));
        log.debug('DynDns initialised', this._config);

        if (this._config.region) {
            AWS.config.update({region: this._config.region}); // e.g. eu-west-1
        }   
    }

    static get UPDATE_RESPONSES() {
        return UPDATE_RESPONSES;
    }

    /**
     * Initializes the class. Call once before calling {@linkcode DynDns#update}.
     * 
     */
    async init() {
        this._zones  = await this.listHostedZones();
    }

    /**
     * Retrieves a list of all hosted zones for the current AWS context.
     * 
     * @returns {Array} An array of configuration objects as returned by 
     *      [ListHostedZones]{@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Route53.html#listHostedZones-property}
     */
    async listHostedZones() {
        let route53 = new AWS.Route53();
        let zones = [], marker, ended = false;

        return new Promise(async (resolve, reject) => {
            do {
                var params = {
                    Marker: marker,
                    MaxItems: '100'
                };
                let request = route53.listHostedZones(params);
                let data;
                try {
                    data = await request.promise();
                }
                catch (ex) {
                    reject(ex);
                    return;
                }

                zones = zones.concat(data.HostedZones);
                marker = data.NextMarker;
                ended = !data.IsTruncated;

            } while (!ended);

            resolve(zones);
        });
    }

    /**
     * Updates the specified host's DNS zone file entry with the specified IP address.
     * 
     * @param {string} host The host name to update.
     * @param {string} ip The IP address to assign to the host.
     */
    async update(host, ip) {
        log.debug(`Update called for host ${host} with IP ${ip}`, { host, ip });

        // Find hosted zone that matches host

        // Retrieve resource records for hosted zone

        // Find resource record for host - needs to be an existing A record

        // If IP hasn't changed then return NOCHG

        // Update IP address and return GOOD
    }

}

/*
AWS.config.update(
    {
        region: AWS_REGION,
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
);


//Update AWS Route53 based on new IP address
var UpdateEntryInRoute53 = function () {
    //Prepare comment to be used in API call to AWS
    var paramsComment = null;
    paramsComment = 'Updating public IP from ' + previousIP + ' to ' + currentIP + ' based on ISP change';

    //Create params required by AWS-SDK for Route53
    var params = {
    HostedZoneId: ROUTE53_HOSTED_ZONE_ID,
    ChangeBatch: {
        Changes: [
        {
            Action: 'UPSERT',
            ResourceRecordSet: {
            Name: ROUTE53_DOMAIN,
            ResourceRecords: [
                {
                Value: currentIP
                }
            ],
            Type: ROUTE53_TYPE,
            TTL: ROUTE53_TTL,
            }
        }
        ],
        Comment: paramsComment
    }
    };

    log.info('Initiating request to AWS Route53 (Method: changeResourceRecordSets)');

    //Make the call to update Route53 record
    route53.changeResourceRecordSets(params, function(err, data) {
        if (err) {
             log.error('Unable to update Route53!  Error data below:\n', err, err.stack);
             SendErrorNotificationEmail('An error occurred that needs to be reviewed.  Here are logs that are immediately available.<br /><br />' + err.message + '<br /><br />'+ err.stack);
        }
        else {
            // Successful response
             log.info('Request successfully submitted to AWS Route53 to update', ROUTE53_DOMAIN, '(' , ROUTE53_TYPE, 'record) with new Public IP:', currentIP, '\nAWS Route 53 response:\n', data);

        }
    });

};
*/

module.exports = DynDns;