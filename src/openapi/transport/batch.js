/**
 * @module saxo/openapi/transport/batch
 * @ignore
 */

//-- Local variables section --

import TransportQueue from './queue';
import asap from 'asap/raw';
import { formatUrl, createGUID } from '../../utils/string';
import { parse as parseBatch, build as buildBatch } from '../batch-util';
import log from '../../log';

const reUrl = /((https?:)?\/\/)?[^\/]+(.*)/i;

const LOG_AREA = "TransportBatch";

//-- Local methods section --

function emptyQueueIntoServiceGroups() {
	var serviceGroupMap = {};
	for(let i = 0, item; item = this.queue[i]; i++) {
		let serviceGroup = item.serviceGroup;
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
	log.error(LOG_AREA, "Batch request failed", batchResponse);

	for(let i = 0, call; call = callList[i]; i++) {
		// pass on the batch response so that if a batch responds with a 401,
		// and queue is before batch, queue will auto retry
		call.reject(batchResponse);
	}
}

function batchCallSuccess(callList, batchResult) {
	var results = parseBatch(batchResult.response);
	for(let i = 0, call; call = callList[i]; i++) {
		let result = results[i];
		if (result) {
			// decide in the same way as transport whether the call succeeded
			if ((result.status < 200 || result.status > 299) && result.status !== 304) {
				call.reject(result);
			} else {
				call.resolve(result);
			}
		} else {
			log.error(LOG_AREA, "A batch response was missing", { index: i, batchResponse: batchResult });
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

	var subRequests = [];
	var authToken;
	for(let i = 0, call; call = callList[i]; i++) {
		let headers = call.options && call.options.headers;
		if (headers && headers.Authorization) {
			authToken = headers.Authorization;

			let newHeaders = {};
			for(let header in headers) {
				if (header !== "Authorization") {
					newHeaders[header] = headers[header];
				}
			}
			headers = newHeaders;
		}
		let body = call.options && call.options.body;
		if (typeof body !== "string") {
			body = JSON.stringify(body);
		}
		subRequests.push({
			method: call.method,
			headers: headers,
			url: this.basePath + serviceGroup + "/" + formatUrl(call.urlTemplate, call.urlArgs, call.options && call.options.queryParams),
			data: body
		});
	}

	if (!authToken) {
		authToken = this.authProvider.getToken();
	}

	var boundary = createGUID();
	var content = buildBatch(subRequests, boundary, authToken, this.host);

	this.transport.post(serviceGroup, "batch", null, { headers: {"Content-Type": 'multipart/mixed; boundary="' + boundary + '"'}, body: content, cache: false})
		.then(batchCallSuccess.bind(this, callList))
		.catch(batchCallFailure.bind(this, callList));
}

//-- Exported methods section --

/**
 * Creates a wrapper around transport to provide auto-batching functionality. If you use the default of 0ms then this transport will join
 * together all calls that happen inside the current call stack and join them into a batch call.
 * @class
 * @alias saxo.openapi.TransportBatch
 * @param {Transport} transport - Instance of the transport class to wrap.
 * @param {string} baseUrl - Base URL for batch requests. This should be an absolute URL.
 * @param {{getToken:function}} [authProvider] - Optional instance of an auth provider, such as TransportAuth.auth, used to add authentication to each batch item.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=0] - Timeout after starting to que items before sending a batch request.
 * @param {string} [options.host=global.location.host] - The host to use in the batch request. If not set defaults to global.location.host.
 */
function TransportBatch(transport, baseUrl, authProvider, options) {
	TransportQueue.call(this, transport);

	if (!baseUrl) {
		throw new Error("Missing required parameter: baseUrl in TransportBatch");
	}

	var splitBaseUrl = baseUrl.match(reUrl);

	if (!splitBaseUrl) {
		// the regular expression will match anything but "" and "/"
		throw new Error("baseUrl is not valid - unable to extract path");
	}

	var basePath = splitBaseUrl[3] || "/";

	if (basePath[basePath.length-1] !== "/") {
		basePath += "/";
	}

	this.basePath = basePath;

	if (options && options.host) {
		this.host = options.host;
	} else {
		this.host = location.host;
	}

	this.authProvider = authProvider;
	this.timeoutMs = options && options.timeoutMs || 0;
	this.isQueueing = true;

	this.runBatches = this.runBatches.bind(this);
}
TransportBatch.prototype = Object.create(TransportQueue.prototype, {constructor: { value: TransportBatch, enumerable: false, writable: true, configurable: true }});

/**
 * @private
 * @param item
 */
TransportBatch.prototype.addToQueue = function(item) {

	TransportQueue.prototype.addToQueue.call(this, item);
	if (!this.nextTickTimer || this.timeoutMs > 0) {
		if (this.timeoutMs === 0) {
			this.nextTickTimer = true;
			asap(this.runBatches);
		} else {
			if (this.nextTickTimer) {
				clearTimeout(this.nextTickTimer);
			}
			this.nextTickTimer = setTimeout(this.runBatches, this.timeoutMs);
		}
	}
};

/**
 * @private
 * @param item
 */
TransportBatch.prototype.runBatches = function() {
	this.nextTickTimer = false;
	var serviceGroupMap = emptyQueueIntoServiceGroups.call(this);
	var serviceGroups = Object.keys(serviceGroupMap);
	for(let i = 0, l = serviceGroups.length; i < l; i++) {
		var serviceGroupList = serviceGroupMap[serviceGroups[i]];
		if (serviceGroupList.length === 1) {
			this.runQueueItem(serviceGroupList[0]);
		} else {
			runBatchCall.call(this, serviceGroups[i], serviceGroupList);
		}
	}
};

//-- Export section --
export default TransportBatch;
