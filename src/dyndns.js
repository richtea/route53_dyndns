'use strict';
const log = require('lambda-log');

/*
const util = require('util');
const AWS = require('aws-sdk');
*/

const UPDATE_RESPONSES = {
    GOOD: 'Good', // Updated successfully
    NOCHG: 'Not changed', // No change to the ip address was required
    NOHOST: 'The specified host does not exist' // Host not found
};

class DynDns {
    constructor(config = {}) {
        // Make a deep copy of the config object - asssumes it is simple JS object with
        // no functions etc. 
        this._config = JSON.parse(JSON.stringify(config));
        log.debug('DynDns initialised', this._config);
    }

    static get UPDATE_RESPONSES() {
        return UPDATE_RESPONSES;
    }

    update(host, ip) {
        
    }


/*
AWS.config.update(
    {
        region: AWS_REGION,
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
);

//Create required AWS-SDK objects
var route53 = new AWS.Route53();

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

}

module.exports = DynDns;