import { nextTick } from '../../utils/function';
import { getRequestId } from '../../utils/request';
import { formatUrl } from '../../utils/string';
import { parse as parseBatch, build as buildBatch } from '../batch-util';
import log from '../../log';
import { shouldUseCloud } from './options';
import type { QueueItem } from './queue';
import TransportQueue from './queue';
import type { Services, TransportOptions } from './types';
import type { OAPICallResult, NetworkError } from '../../utils/fetch';
import type { ITransport } from './transport-base';

const URLRegex = /((https?:)?\/\/)?[^/]+(.*)/i;

const LOG_AREA = 'TransportBatch';

function getParentRequestId(batchResult: OAPICallResult) {
    let parentRequestId = 0;

    if (batchResult.headers) {
        // @ts-expect-error expect invalid input, NaN handled in the next line
        parentRequestId = parseInt(batchResult.headers.get('x-request-id'), 10);
        parentRequestId = isNaN(parentRequestId) ? 0 : parentRequestId;
    }
    return parentRequestId;
}

/**
 * Creates a wrapper around transport to provide auto-batching functionality. If you use the default of 0ms then this transport will join
 * together all calls that happen inside the current call stack and join them into a batch call.
 * @param {Transport} transport - Instance of the transport class to wrap.
 * @param {string} baseUrl - Base URL for batch requests. This should be an absolute URL.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=0] - Timeout after starting to que items before sending a batch request.
 * @param {string} [options.host=global.location.host] - The host to use in the batch request. If not set defaults to global.location.host.
 * @param {Object.<string, saxo.ServiceOptions>} [options.services] - Per-service options, keyed by service path.
 */

class TransportBatch extends TransportQueue {
    basePath = '';
    host: string = location.host;
    timeoutMs = 0;
    services: Services = {};
    isQueueing = true;
    nextTickTimer: ReturnType<typeof setTimeout> | boolean = false;

    constructor(
        transport: ITransport,
        baseUrl?: string | null,
        options?: TransportOptions | null,
    ) {
        super(transport);

        if (!baseUrl) {
            throw new Error(
                'Missing required parameter: baseUrl in TransportBatch',
            );
        }

        const splitBaseUrl = baseUrl.match(URLRegex);

        if (!splitBaseUrl) {
            // the regular expression will match anything but "" and "/"
            throw new Error('baseUrl is not valid - unable to extract path');
        }

        let basePath = splitBaseUrl[3] || '/';

        if (basePath[basePath.length - 1] !== '/') {
            basePath += '/';
        }

        // Batching is a service group level facility, so isn't applicable/available for /oapi
        this.basePath = basePath + 'openapi/';

        if (options?.host) {
            this.host = options.host;
        }

        this.timeoutMs = options?.timeoutMs || 0;
        this.services = options?.services || {};
    }

    protected shouldQueue(item: QueueItem) {
        return !shouldUseCloud(this.services[item.servicePath]);
    }

    private batchCallFailure = (
        callList: QueueItem[],
        batchResponse: OAPICallResult | NetworkError,
    ) => {
        const isAuthFailure = batchResponse?.status === 401;
        const isNetworkError =
            !batchResponse ||
            // Some responses same to be in error but not have isNetworkError defined
            (typeof batchResponse.isNetworkError === 'boolean'
                ? batchResponse.isNetworkError
                : !batchResponse.status);

        const logFunction =
            isAuthFailure || isNetworkError ? log.debug : log.error;
        logFunction(LOG_AREA, 'Batch request failed', batchResponse);

        for (let i = 0; i < callList.length; i++) {
            // pass on the batch response so that if a batch responds with a 401,
            // and queue is before batch, queue will auto retry
            callList[i].reject({
                message: 'batch failed',
                status: isAuthFailure ? 401 : undefined,
                isNetworkError,
            });
        }
    };

    private batchCallSuccess = (
        callList: QueueItem[],
        batchResult: OAPICallResult,
    ) => {
        // Previously occurred due to a bug in the auth transport
        if (!(batchResult && batchResult.response)) {
            log.error('Received success call without response', batchResult);
            this.batchCallFailure(callList, batchResult);
            return;
        }

        const parentRequestId = getParentRequestId(batchResult);

        // expecting batch call response to be string
        const results = parseBatch(
            batchResult.response as string,
            parentRequestId,
        );

        for (let i = 0; i < callList.length; i++) {
            const call = callList[i];
            const result = results[i];
            if (result) {
                // decide in the same way as transport whether the call succeeded
                if (
                    result.status &&
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
    };

    runBatches = () => {
        this.nextTickTimer = false;
        const serviceGroupMap = this.emptyQueueIntoServiceGroups();
        const serviceGroups = Object.keys(serviceGroupMap);
        for (let i = 0, l = serviceGroups.length; i < l; i++) {
            const serviceGroupList = serviceGroupMap[serviceGroups[i]];
            if (serviceGroupList.length === 1) {
                this.runQueueItem(serviceGroupList[0]);
            } else {
                this.runBatchCall(serviceGroups[i], serviceGroupList);
            }
        }
    };

    private emptyQueueIntoServiceGroups = () => {
        const serviceGroupMap: Record<string, QueueItem[]> = {};
        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            const serviceGroup = item.servicePath;
            let serviceGroupList = serviceGroupMap[serviceGroup];
            if (!serviceGroupList) {
                serviceGroupList = serviceGroupMap[serviceGroup] = [];
            }
            serviceGroupList.push(item);
        }
        this.queue.length = 0;
        return serviceGroupMap;
    };

    /**
     * Runs a batch call for a number of sub calls
     * @param {string} serviceGroup
     * @param {Array.<{method: string, args:Array}>} callList
     */
    private runBatchCall = (serviceGroup: string, callList: QueueItem[]) => {
        // Request id for container request that contains all child batched requests.
        // It's required to request it before all child requests are built to preserve correct x-request-id order.
        // Correct x-request-id order is important when parsing batch response.
        const parentRequestId = getRequestId().toString();

        const subRequests = [];
        let subRequestHasExtendedAssetTypeHeader = false;
        for (let i = 0; i < callList.length; i++) {
            const call = callList[i];
            const headers = call.options && call.options.headers;
            let body = call.options && call.options.body;
            if (typeof body !== 'string') {
                body = JSON.stringify(body);
            }

            if (headers && headers['Pragma'] === 'oapi-x-extasset') {
                subRequestHasExtendedAssetTypeHeader = true;
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

        const headers: Record<string, string> = {
            'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
        };
        if (subRequestHasExtendedAssetTypeHeader) {
            headers.Pragma = 'oapi-x-extasset';
        }

        this.transport
            .post(serviceGroup, 'batch', null, {
                headers,
                body,
                cache: false,
                requestId: parentRequestId,
            })
            .then((batchResult: OAPICallResult) =>
                this.batchCallSuccess(callList, batchResult),
            )
            .catch((errorResponse: OAPICallResult | NetworkError) =>
                this.batchCallFailure(callList, errorResponse),
            );
    };

    protected addToQueue(item: QueueItem) {
        super.addToQueue(item);
        if (!this.nextTickTimer || this.timeoutMs > 0) {
            if (this.timeoutMs === 0) {
                this.nextTickTimer = true;
                nextTick(this.runBatches);
            } else {
                if (this.nextTickTimer) {
                    return;
                }
                this.nextTickTimer = setTimeout(
                    this.runBatches,
                    this.timeoutMs,
                );
            }
        }
    }
}

export default TransportBatch;
