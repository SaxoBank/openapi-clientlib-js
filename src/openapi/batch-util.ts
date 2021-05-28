/**
 * @module saxo/openapi/batch-util
 * @ignore
 */

import log from '../log';
import { getRequestId, globalToLocalRequestId } from '../utils/request';

// -- Local variables section --

const requestRx = /X-Request-Id: ([0-9]+)/;
const httpCodeRx = /HTTP\/1.1 ([0-9]+)/;

const LOG_AREA = 'batch';

// -- Local methods section --

// -- Exported methods section --

/**
 * Utilities to build and parse batch requests
 * @namespace saxo.openapi.batchUtil
 */

/**
 * Parses the response from a batch call.
 * @name saxo.openapi.batchUtil.parse
 * @param {string} responseText
 * @param {Number} parentRequestId - The parent request id. Used as a base for calculating batch items request ids.
 * @returns {Array.<{status:string, response: Object}>} An array of responses, in the position of the response id's.
 */
function parse(responseText, parentRequestId = 0) {
    if (!responseText) {
        throw new Error('Required Parameter: responseText in batch parse');
    }

    const lines = responseText.split('\r\n');
    const responseBoundary = lines[0];
    let currentData = null;
    let requestId = null;
    const responseData = [];
    for (let i = 0, l = lines.length; i < l; i++) {
        const line = lines[i];
        if (line.length) {
            if (!responseData[requestId]) {
                requestId = line.match(requestRx);
                if (requestId) {
                    requestId = parseInt(requestId[1], 10);
                    requestId = globalToLocalRequestId(
                        requestId,
                        parentRequestId,
                    );
                    responseData[requestId] = {};
                }
            }

            if (line.indexOf(responseBoundary) === 0) {
                if (currentData) {
                    requestId =
                        requestId === null ? responseData.length : requestId;
                    responseData[requestId] = currentData;
                }

                requestId = null;
                currentData = {};
            } else if (currentData) {
                if (!currentData.status) {
                    const statusMatch = line.match(httpCodeRx);
                    if (statusMatch) {
                        // change the status to be a number to match fetch
                        currentData.status = Number(statusMatch[1]);
                    }
                } else if (!currentData.response) {
                    const firstCharacter = line.charAt(0);
                    if (
                        firstCharacter === '{' ||
                        firstCharacter === '[' ||
                        firstCharacter === '"'
                    ) {
                        try {
                            currentData.response = JSON.parse(line);
                        } catch (error) {
                            log.error(
                                LOG_AREA,
                                'Unexpected error parsing json',
                                { error, line, requestId },
                            );
                        }
                    }
                }
            }
        }
    }

    return responseData;
}

/**
 * Builds up a string of the data for a batch request.
 * @name saxo.openapi.batchUtil.build
 * @param {Array.<{method: string, headers: ?Object.<string, string>, url: string, data: ?string}>} subRequests - The sub requests of the batch.
 * @param {string} host - The host of the sender.
 * @returns { body: string, boundary: string }
 */
function build(subRequests, host) {
    if (!subRequests || !host) {
        throw new Error(
            'Missing required parameters: batch build requires sub requests and host',
        );
    }

    const body = [];
    let boundary = '--+';

    for (let i = 0, l = subRequests.length; i < l; i++) {
        const request = subRequests[i];
        if (
            request.data &&
            request.data.substr(0, boundary.length) === boundary
        ) {
            const nextCharacter =
                request.data.substr(boundary.length, 1) === '+' ? '-' : '+';
            boundary += nextCharacter;
        }
    }

    for (let i = 0, l = subRequests.length; i < l; i++) {
        const request = subRequests[i];
        const method = request.method.toUpperCase();

        body.push(boundary);
        body.push('Content-Type:application/http; msgtype=request', '');

        body.push(method + ' ' + request.url + ' HTTP/1.1');
        body.push('X-Request-Id:' + getRequestId());
        if (request.headers) {
            for (const header in request.headers) {
                if (request.headers.hasOwnProperty(header)) {
                    body.push(header + ':' + request.headers[header]);
                }
            }
        }

        /* Don't care about content type for requests that have no body. */
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            body.push('Content-Type:application/json; charset=utf-8');
        }

        body.push('Host:' + host, '');
        body.push(request.data || '');
    }

    body.push(boundary + '--', '');
    return {
        body: body.join('\r\n'),
        boundary: boundary.substr(2),
    };
}

// -- Export section --

export { parse, build };
