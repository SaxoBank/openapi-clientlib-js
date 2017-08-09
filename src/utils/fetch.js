/**
 * @module saxo/utils/fetch
 * @ignore
 */

import log from '../log';

// -- Local variables section --

const LOG_AREA = 'Fetch';

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
function convertFetchReject(url, body, result) {
    return convertFetchResponse(url, body, result, true);
}

/**
 * Converts the fetch response and returns either a resolved or rejected Promise.
 * @param result
 */
function convertFetchSuccess(url, body, result) {
    // See also the same logic applied to the batch response
    if ((result.status < 200 || result.status > 299) && result.status !== 304) {
        return convertFetchResponse(url, body, result, true);
    }
    return convertFetchResponse(url, body, result);
}

/**
 * Parses the json or gets the text from the response as required.
 * @param result
 * @returns {Promise}
 */
function convertFetchResponse(url, body, result, isRejected) {

    // if this ia an exception rather than a result, reject immediately without
    // trying to parse
    if (!result || !result.status || !result.headers) {
        log.error(LOG_AREA, 'rejected non-response', {
            url,
            body,
            result,
        });

        throw result;
    }
    const contentType = result.headers.get('content-type');
    let convertedPromise;
    if (contentType && contentType.indexOf('application/json') > -1) {
        convertedPromise = result.text()
            .then(function(text) {
                try {
                    return {
                        response: JSON.parse(text),
                        status: result.status,
                        headers: result.headers,
                        size: text.length,
                        url,
                    };
                } catch (e) {
                    log.error(LOG_AREA, 'Received a JSON response from OpenApi that could not be parsed', {
                        text,
                        response: result,
                        size: text.length,
                        url,
                    });
                    return {
                        response: text,
                        status: result.status,
                        headers: result.headers,
                        size: text.length,
                        url,
                    };
                }
            });
    } else if (contentType && contentType.indexOf('multipart/mixed') > -1) {
        convertedPromise = result.text()
            .then(function(text) {
                return {
                    response: text,
                    status: result.status,
                    headers: result.headers,
                    size: text.length,
                    url,
                };
            });
    } else if (contentType && contentType.indexOf('image/') > -1) {
        convertedPromise = result.blob().then(function(blob) {
            return {
                response: blob,
                status: result.status,
                headers: result.headers,
                size: blob.size,
                url,
            };
        });
    } else if (contentType && contentType.indexOf('application/') > -1) {
        convertedPromise = result.blob().then(function(blob) {
            return {
                response: blob,
                status: result.status,
                headers: result.headers,
                size: blob.size,
                url,
            };
        });
    } else {
        convertedPromise = result.text().then(function(text) {
            return {
                response: text,
                status: result.status,
                headers: result.headers,
                size: text ? text.length : 0,
                url,
            };
        }).catch(() => {
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

    if (isRejected) {
        convertedPromise = convertedPromise.then((newResult) => {
            log.warn(LOG_AREA, 'rejected server response', {
                url,
                body,
                status: newResult.status,
                response: newResult.response,
            });

            throw newResult;
        });
    }

    return convertedPromise;
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
 * @param {string} [options.body] - The body of the request. If this is an object it is converted to JSON and
 *                                  the appropriate content-type header added.
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

    let body = options && options.body;
    const headers = (options && options.headers) || {};
    const cache = options && options.cache;
    let credentials = options && options.credentials;
    const useXHttpMethodOverride = options && options.useXHttpMethodOverride;

    if (!credentials) {
        credentials = 'include';
    }

    // encode objects. Batch calls come through as strings.
    if (body && typeof body === 'object') {
        body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json; charset=UTF-8';
    }

    if (useXHttpMethodOverride && (method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
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
    return fetch(url, { headers, method, body, credentials })
        .then(convertFetchSuccess.bind(null, url, body), convertFetchReject.bind(null, url, body));
}

// -- Export section --

export default localFetch;
