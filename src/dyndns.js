'use strict';
const log = require('lambda-log');
const AWS = require('aws-sdk');

/*
const util = require('util');

*/

const UPDATE_RESPONSES = {
    GOOD: 'good', // Updated successfully
    NOCHG: 'nochg', // No change to the ip address was required
    NOHOST: 'nohost', // Host not found
    NOTFQDN: 'notfqdn', // Not a valid FQDN
    DNSERROR: 'dnserror', // Error updating AWS
    PANIC: '911' // General error
};

class DynDns {
    constructor(config = {}) {
        // Make a deep copy of the config object - asssumes it is simple JS object with
        // no functions etc.
        this._config = JSON.parse(JSON.stringify(config));
        log.debug('DynDns instantiated', this._config);

        if (this._config.region) {
            AWS.config.update({ region: this._config.region }); // e.g. eu-west-1
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
        this._zones = await this.listHostedZones();
        log.debug('DynDns initialised');
    }

    /**
     * Retrieves a list of all hosted zones for the current AWS context.
     *
     * @returns {Array} An array of configuration objects as returned by
     *      [ListHostedZones]{@link https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Route53.html#listHostedZones-property}
     */
    async listHostedZones() {
        let route53 = new AWS.Route53();
        let zones = [];
        let marker;
        let ended = false;

        return new Promise(async (resolve, reject) => {
            do {
                let params = {
                    Marker: marker,
                    MaxItems: '100'
                };
                let request = route53.listHostedZones(params);
                let data;
                try {
                    data = await request.promise();
                } catch (ex) {
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
     * @param {string} hostName The host name to update.
     * @param {string} ip The IP address to assign to the host.
     */
    async update(hostName, ip) {
        log.debug(`update: called for host ${hostName} with IP ${ip}`, { hostName, ip });

        // AWS always maintains trailing dot
        if (!hostName.endsWith('.')) {
            hostName += '.';
        }

        // Find hosted zone that matches host
        let zone = this.findHostedZone(hostName);
        if (!zone) {
            log.info(`update: zone not found for host '${hostName}'`);
            return UPDATE_RESPONSES.NOHOST;
        }

        // Retrieve resource record set for host
        let result = await this.getResourceRecordSetForHost(zone.Id, hostName);

        if (result.err) {
            log.info(`update: error reading 'A' record for '${hostName}': '${result.err}'`);
            return UPDATE_RESPONSES.NOHOST;
        }

        // If IP hasn't changed then return NOCHG
        let currentIp = result.data.ResourceRecords[0].Value;
        if (currentIp === ip) {
            log.info(`update: no change required for '${hostName}', current IP is '${currentIp}'`);
            return `${UPDATE_RESPONSES.NOCHG} ${currentIp}`;
        }

        // Update IP address and return GOOD
        let batchComment = `Updating IP in zone ${zone.Id}: changing ${hostName} from ${currentIp} to ${ip}`;
        let ttl = result.data.TTL;

        let rc;
        log.info(`update: ${batchComment}`);
        try {
            await this.updateDnsRecord(zone.Id, hostName, ip, ttl, batchComment);
            log.info(`update: DNS record for '${hostName} updated to ${ip}'`);
            rc = `${UPDATE_RESPONSES.GOOD} ${ip}`;
        } catch (ex) {
            log.error(`Error calling AWS to update DNS record: ${ex.messsage}`);
            log.info(ex);
            rc = `${UPDATE_RESPONSES.DNSERROR}`;
        }

        return rc;
    }

    findHostedZone(host) {
        log.debug(`findHostedZone: looking for ${host}`);

        return this._zones.find(z => {
            return host.endsWith(z.Name);
        });
    }

    /**
     * Gets the DNS record set for the specified host name within a hosted zone.
     *
     * @param {string} zoneId The ID of the AWS hosted zone.
     * @param {string} hostName The hostname of the host for which to retrieve records (should have trailing dot).
     * @returns {object} An object containing the DNS data for the host and a string containing error information.
     */
    async getResourceRecordSetForHost(zoneId, hostName) {
        log.debug(`getResourceRecordsForZone: getting records for ${hostName} in ${zoneId}`);
        let route53 = new AWS.Route53();

        let params = {
            HostedZoneId: zoneId,
            StartRecordType: 'A',
            StartRecordName: hostName,
            MaxItems: '1'
        };
        let request = route53.listResourceRecordSets(params);
        let data;

        log.debug(`getResourceRecordsForZone: calling listResourceRecordSets`, params);
        data = await request.promise();
        log.debug(`getResourceRecordsForZone: result: `, data);

        if (!data.ResourceRecordSets.length) {
            // Host not found
            return { data: null, err: 'No A records found for host' };
        }

        let record = data.ResourceRecordSets[0];

        if (!(record.Name === hostName && record.Type === 'A')) {
            // Host not found
            return { data: null, err: 'No A records found for host' };
        }

        return { data: record, err: null };
    }

    /**
     * Updates the AWS DNS record for the specified host.
     * @param {string} zoneId The hosted zone ID.
     * @param {string} hostName The host name to update.
     * @param {string} newIp The new IP address.
     * @param {string} ttl The new TTL.
     * @param {string} batchComment The comment to be associated with the AWS batch update.
     */
    async updateDnsRecord(zoneId, hostName, newIp, ttl, batchComment) {
        let route53 = new AWS.Route53();

        var params = {
            HostedZoneId: zoneId,
            ChangeBatch: {
                Changes: [
                    {
                        Action: 'UPSERT',
                        ResourceRecordSet: {
                            Name: hostName,
                            ResourceRecords: [
                                {
                                    Value: newIp
                                }
                            ],
                            Type: 'A',
                            TTL: ttl
                        }
                    }
                ],
                Comment: batchComment
            }
        };

        let request = route53.changeResourceRecordSets(params);
        let response = await request.promise();

        log.info(``, response);
    }
}

module.exports = DynDns;
