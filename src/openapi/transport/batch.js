/**
 * @module saxo/openapi/transport/batch
 * @ignore
 */

// -- Local variables section --

import TransportQueue from './queue';
import { nextTick } from '../../utils/function';
import { getRequestId } from '../../utils/request';
import { formatUrl } from '../../utils/string';
import { parse as parseBatch, build as buildBatch } from '../batch-util';
import log from '../../log';

const reUrl = /((https?:)?\/\/)?[^/]+(.*)/i;

const LOG_AREA = 'TransportBatch';

// -- Local methods section --

function emptyQueueIntoServiceGroups() {
    const serviceGroupMap = {};
    for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        const serviceGroup = item.serviceGroup;
        let serviceGroupList = serviceGroupMap[serviceGroup];
        if (!serviceGroupList) {
            serviceGroupList = serviceGroupMap[serviceGroup] = [];
        }
        serviceGroupList.push(item);
    }
    this.queue.length = 0;
    return serviceGroupMap;
}

function batchCallFailure(callList, batchResponse) {
    const isAuthFailure = batchResponse && batchResponse.status === 401;

    const logFunction =
        isAuthFailure || batchResponse.isNetworkError ? log.debug : log.error;
    logFunction(LOG_AREA, 'Batch request failed', batchResponse);

    for (let i = 0; i < callList.length; i++) {
        // pass on the batch response so that if a batch responds with a 401,
        // and queue is before batch, queue will auto retry
        callList[i].reject({
            message: 'batch failed',
            status: isAuthFailure ? 401 : undefined,
            isNetworkError: batchResponse.isNetworkError,
        });
    }
}

function getParentRequestId(batchResult) {
    let parentRequestId = 0;

    if (batchResult.headers) {
        parentRequestId = parseInt(batchResult.headers.get('x-request-id'), 10);
        parentRequestId = isNaN(parentRequestId) ? 0 : parentRequestId;
    }
    return parentRequestId;
}

function batchCallSuccess(callList, batchResult) {
    // not sure why this occurs, but logs indicate it does
    if (!(batchResult && batchResult.response)) {
        batchCallFailure(callList, batchResult);
        return;
    }

    const parentRequestId = getParentRequestId(batchResult);

    const results = parseBatch(batchResult.response, parentRequestId);

    for (let i = 0; i < callList.length; i++) {
        const call = callList[i];
        const result = results[i];
        if (result) {
            // decide in the same way as transport whether the call succeeded
            if (
                (result.status < 200 || result.status > 299) &&
                result.status !== 304
            ) {
                call.reject(result);
            } else {
                call.resolve(result);
            }
        } else {
            log.error(LOG_AREA, 'A batch response was missing', {
                index: i,
                ...batchResult,
            });
            call.reject();
        }
    }
}

/**
 * Runs a batch call for a number of sub calls
 * @param {string} serviceGroup
 * @param {Array.<{method: string, args:Array}>} callList
 */
function runBatchCall(serviceGroup, callList) {
    // Request id for container request that contains all child batched requests.
    // It's required to request it before all child requests are built to preserve correct x-request-id order.
    // Correct x-request-id order is important when parsing batch response.
    const parentRequestId = getRequestId();

    const subRequests = [];
    for (let i = 0; i < callList.length; i++) {
        const call = callList[i];
        const headers = call.options && call.options.headers;
        let body = call.options && call.options.body;
        if (typeof body !== 'string') {
            body = JSON.stringify(body);
        }
        subRequests.push({
            method: call.method,
            headers,
            url:
                this.basePath +
                serviceGroup +
                '/' +
                formatUrl(
                    call.urlTemplate,
                    call.urlArgs,
                    call.options && call.options.queryParams,
                ),
            data: body,
        });
    }

    const { body, boundary } = buildBatch(subRequests, this.host);

    this.transport
        .post(serviceGroup, 'batch', null, {
            headers: {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
            },
            body,
            cache: false,
            requestId: parentRequestId,
        })
        .then(batchCallSuccess.bind(this, callList))
        .catch(batchCallFailure.bind(this, callList));
}

// -- Exported methods section --

/**
 * Creates a wrapper around transport to provide auto-batching functionality. If you use the default of 0ms then this transport will join
 * together all calls that happen inside the current call stack and join them into a batch call.
 * @class
 * @alias saxo.openapi.TransportBatch
 * @param {Transport} transport - Instance of the transport class to wrap.
 * @param {string} baseUrl - Base URL for batch requests. This should be an absolute URL.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=0] - Timeout after starting to que items before sending a batch request.
 * @param {string} [options.host=global.location.host] - The host to use in the batch request. If not set defaults to global.location.host.
 */
function TransportBatch(transport, baseUrl, options) {
    TransportQueue.call(this, transport);

    if (!baseUrl) {
        throw new Error(
            'Missing required parameter: baseUrl in TransportBatch',
        );
    }

    const splitBaseUrl = baseUrl.match(reUrl);

    if (!splitBaseUrl) {
        // the regular expression will match anything but "" and "/"
        throw new Error('baseUrl is not valid - unable to extract path');
    }

    let basePath = splitBaseUrl[3] || '/';

    if (basePath[basePath.length - 1] !== '/') {
        basePath += '/';
    }

    this.basePath = basePath;

    if (options && options.host) {
        this.host = options.host;
    } else {
        this.host = location.host;
    }

    this.timeoutMs = (options && options.timeoutMs) || 0;
    this.isQueueing = true;
}
TransportBatch.prototype = Object.create(TransportQueue.prototype, {
    constructor: {
        value: TransportBatch,
        enumerable: false,
        writable: true,
        configurable: true,
    },
});

/**
 * @private
 * @param item
 */
TransportBatch.prototype.addToQueue = function(item) {
    TransportQueue.prototype.addToQueue.call(this, item);
    if (!this.nextTickTimer || this.timeoutMs > 0) {
        if (this.timeoutMs === 0) {
            this.nextTickTimer = true;
            nextTick(this.runBatches.bind(this));
        } else {
            if (this.nextTickTimer) {
                return;
            }
            this.nextTickTimer = setTimeout(
                this.runBatches.bind(this),
                this.timeoutMs,
            );
        }
    }
};

/**
 * @private
 * @param item
 */
TransportBatch.prototype.runBatches = function() {
    this.nextTickTimer = false;
    const serviceGroupMap = emptyQueueIntoServiceGroups.call(this);
    const serviceGroups = Object.keys(serviceGroupMap);
    for (let i = 0, l = serviceGroups.length; i < l; i++) {
        const serviceGroupList = serviceGroupMap[serviceGroups[i]];
        if (serviceGroupList.length === 1) {
            this.runQueueItem(serviceGroupList[0]);
        } else {
            runBatchCall.call(this, serviceGroups[i], serviceGroupList);
        }
    }
};

// -- Export section --
export default TransportBatch;
