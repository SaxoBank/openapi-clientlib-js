﻿/**
 * @module saxo/utils/fetch
 * @ignore
 */

import log from '../log';

// -- Local variables section --

const LOG_AREA = 'Fetch';

// list of content-types that will be treated as binary blobs
const binaryContentTypes = {
    'application/pdf': true,
    'application/octet-stream': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
};

/**
 * Follows the jQuery way of cache breaking - start with the current time and add 1 per request,
 * meaning you would have to do more than 1000 per second
 * for 2 numbers to repeat across sessions.
 */
let cacheBreakNum = Date.now();

// -- Local methods section --

/**
 * Returns a rejected promise, needed to keep the promise rejected.
 * @param result
 */
export function convertFetchReject(url, body, timerId, error) {
    clearTimeout(timerId);

    log.debug(LOG_AREA, 'Rejected non-response', {
        url,
        body,
        error,
    });

    const networkError = {
        message: error && error.message ? error.message : error,
        isNetworkError: true,
    };

    return Promise.reject(networkError);
}

/**
 * Returns either a resolved or rejected Promise.
 * If resolved, parses the json or gets the text from the response as required.
 * @param result
 * @returns {Promise}
 */
export function convertFetchSuccess(url, body, timerId, result) {
    clearTimeout(timerId);

    let convertedPromise;

    const contentType = result.headers.get('content-type');
    if (contentType && contentType.indexOf('application/json') > -1) {
        convertedPromise = result.text().then(function(text) {
            try {
                return {
                    response: JSON.parse(text),
                    status: result.status,
                    headers: result.headers,
                    size: text.length,
                    url,
                    responseType: 'json',
                };
            } catch (e) {
                // We get interrupted downloads causing partial chunks of json
                // and occasional malformed responses or empty proxy responses
                log.error(
                    LOG_AREA,
                    'Received a JSON response that could not be parsed',
                    {
                        text,
                        response: result,
                        size: text.length,
                        url,
                    },
                );
                return {
                    response: text,
                    status: result.status,
                    headers: result.headers,
                    size: text.length,
                    url,
                    responseType: 'text',
                };
            }
        });
    } else if (contentType && contentType.indexOf('multipart/mixed') > -1) {
        convertedPromise = result.text().then(function(text) {
            return {
                response: text,
                status: result.status,
                headers: result.headers,
                size: text.length,
                url,
                responseType: 'text',
            };
        });
    } else if (
        contentType &&
        (contentType.indexOf('image/') > -1 || binaryContentTypes[contentType])
    ) {
        convertedPromise = result.blob().then(function(blob) {
            return {
                response: blob,
                status: result.status,
                headers: result.headers,
                size: blob.size,
                url,
                responseType: 'blob',
            };
        });
    } else {
        convertedPromise = result
            .text()
            .then(function(text) {
                return {
                    response: text,
                    status: result.status,
                    headers: result.headers,
                    size: text ? text.length : 0,
                    url,
                    responseType: 'text',
                };
            })
            .catch(() => {
                // since we guess that it can be interpreted as text, do not fail the promise
                // if we fail to get text
                return {
                    status: result.status,
                    headers: result.headers,
                    size: 0,
                    url,
                };
            });
    }

    if (
        !result.status ||
        ((result.status < 200 || result.status > 299) && result.status !== 304)
    ) {
        convertedPromise = convertedPromise.then((newResult) => {
            const correlation = result.headers.get('x-correlation') || '';

            // Form of correlation header is: {sessionId}#{AppId}#{requestId}#{serverDigits}
            const requestId = correlation.split('#')[2];

            const logFunction =
                result.status > 499 || result.status < 400
                    ? log.error
                    : log.info;

            logFunction(LOG_AREA, 'Rejected server response', {
                url,
                body,
                status: newResult.status,
                response: newResult.response,
                requestId: requestId || null,
                isNetworkError: false,
            });

            throw newResult;
        });
    }

    return convertedPromise;
}

function getBody(method, options) {
    // If PATCH without body occurs, create empty payload.
    // Reason: Some proxies and default configs for CDNs like Akamai have issues with accepting PATCH with content-length: 0.
    if (method === 'PATCH' && (!options || !options.body)) {
        return {};
    }

    return options && options.body;
}

// -- Exported methods section --

/**
 * @namespace saxo.utils
 */

/**
 * Performs a fetch and processes the response.
 * All non 200 responses are converted to rejections. The body can be an object and will be JSON.stringified and the right header added.
 * All responses that contain JSON are converted to objects.
 * @function
 * @alias saxo.utils.fetch
 * @param {string} method - The http method.
 * @param {string} url - The url to fetch.
 * @param {Object} [options]
 * @param {string} [options.body] - The body of the request. If this is an object, that is not already handled by the body mixin,
                                    it is converted to JSON and the appropriate content-type header added.
 * @param {Object} [options.headers] - Object of header key to header value.
 * @param {boolean} [options.cache] - Whether or not to cache.
 * @param {string} [options.credentials="include"] - Whether cookies will be included. Will default to true unless overridden.
 *                             "omit" is currently the fetch default
 *                                    {@link https://fetch.spec.whatwg.org/#concept-request-credentials-mode} and means
 *                                    none will be included.
 *                             "same-origin" will include the cookies if on the same domain (this is the XmlHttpRequest default)
 *                             "include" will always include the cookies.
 * @return {Promise<{ status: number, response: Object|String, headers: Object },{ status: number, response: Object|String, headers: Object }|Error>}
 */
function localFetch(method, url, options) {
    let body = getBody(method, options);
    const headers = (options && options.headers) || {};
    const cache = options && options.cache;
    let credentials = options && options.credentials;
    const useXHttpMethodOverride = options && options.useXHttpMethodOverride;

    if (!credentials) {
        credentials = 'include';
    }

    // encode objects. Batch calls come through as strings.
    if (body && typeof body === 'object' && !isAlreadySupported(body)) {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json; charset=UTF-8';
    }

    if (
        useXHttpMethodOverride &&
        (method === 'PUT' || method === 'DELETE' || method === 'PATCH')
    ) {
        headers['X-HTTP-Method-Override'] = method;
        method = 'POST';
    }

    if (cache === false) {
        if (method === 'GET') {
            const cacheBreak = String(cacheBreakNum++);
            url += (url.indexOf('?') > 0 ? '&_=' : '?_=') + cacheBreak;
        }

        // http://stackoverflow.com/questions/12796318/prevent-ios-6-from-caching-ajax-post-requests
        // iOS6 prevent cache
        headers['Cache-Control'] = 'no-cache';
    }

    const timerId = setTimeout(() => {
        log.warn(LOG_AREA, 'Took more than 30 seconds to get a response', {
            url,
        });
    }, 30000);

    return fetch(url, { headers, method, body, credentials })
        .catch(convertFetchReject.bind(null, url, body, timerId))
        .then(convertFetchSuccess.bind(null, url, body, timerId));
}

// Check for handled type: https://fetch.spec.whatwg.org/#bodyinit
// URLSearchParams and ReadableStream are guarded, because they are not supported in IE
// USVString is not handled because it will be typeof "string"
function isAlreadySupported(body) {
    return (
        body instanceof window.Blob ||
        body instanceof window.ArrayBuffer ||
        body instanceof window.FormData ||
        (window.URLSearchParams && body instanceof window.URLSearchParams)
    );
}

// -- Export section --

export default localFetch;
