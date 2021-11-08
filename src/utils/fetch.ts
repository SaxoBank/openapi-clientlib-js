import log from '../log';
import type {
    HTTPMethodType,
    NetworkError,
    NetworkErrorType,
    OAPIRequestResult,
} from '../types';

interface Options {
    /**
     *  The body of the request.
     */
    body?: any;
    /**
     * Object of header key to header value.
     */
    headers?: Record<string, string>;
    /**
     * Whether or not to cache.
     */
    cache?: boolean;
    /**
     * Whether cookies will be included. Will default to true unless overridden.
     * "omit" is currently the fetch default {@link https://fetch.spec.whatwg.org/#concept-request-credentials-mode}
     * and means none will be included.
     * "same-origin" will include the cookies if on the same domain (this is the XmlHttpRequest default)
     * "include" will always include the cookies.
     * @defaultValue "include"
     */
    credentials?: RequestCredentials;
    useXHttpMethodOverride?: boolean;
    /**
     * An AbortSignal to set request's signal.
     */
    signal?: AbortSignal | null;
}

const LOG_AREA = 'Fetch';

// list of content-types that will be treated as binary blobs
const binaryContentTypes: Record<string, boolean> = {
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

function getNetworkError(
    networkErrorType: NetworkErrorType,
    error: Error,
    url: string,
    body: BodyInit | undefined | null,
) {
    log.debug(LOG_AREA, 'Rejected non-response', {
        url,
        body,
        error,
    });

    const networkError: NetworkError = {
        message: error?.message ? error.message : error,
        isNetworkError: true,
        networkErrorType,
        url,
    };

    return Promise.reject(networkError);
}

/**
 * Returns a rejected promise, needed to keep the promise rejected.
 */
export function convertFetchReject(
    url: string,
    body: BodyInit | undefined | null,
    timerId: number,
    error: Error,
) {
    clearTimeout(timerId);

    return getNetworkError('initial-rejection', error, url, body);
}

type ConvertResponse = {
    (
        url: string,
        body: BodyInit | undefined | null,
        type: 'text',
        result: Response,
    ): Promise<string>;
    (
        url: string,
        body: BodyInit | undefined | null,
        type: 'blob',
        result: Response,
    ): Promise<Blob>;
};

const convertResponse = function (
    url: string,
    body: BodyInit | undefined | null,
    type: 'text' | 'blob',
    result: Response,
) {
    try {
        return result[type]().catch((error) => {
            return getNetworkError('convert-response-reject', error, url, body);
        });
    } catch (error) {
        return getNetworkError('convert-response-exception', error, url, body);
    }
} as ConvertResponse;

/**
 * Returns either a resolved or rejected Promise.
 * If resolved, parses the json or gets the text from the response as required.
 */
export function convertFetchSuccess(
    url: string,
    body: BodyInit | undefined | null,
    timerId: number,
    result: Response,
) {
    clearTimeout(timerId);

    let convertedPromise: Promise<OAPIRequestResult>;

    const status = result?.status;
    const headers = result?.headers;
    let contentType: string | null | undefined;
    let didHeadersFail = false;
    try {
        contentType = headers.get('content-type');
    } catch {
        log.warn(LOG_AREA, 'Failed to get content-type header', {
            url,
        });
        didHeadersFail = true;
    }

    const statusCausesRejection =
        !status || ((status < 200 || status > 299) && status !== 304);

    if (contentType?.includes('application/json')) {
        convertedPromise = convertResponse(url, body, 'text', result).then(
            function (text) {
                try {
                    return {
                        response: JSON.parse(text),
                        status,
                        headers,
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
                        status,
                        headers,
                        size: text.length,
                        url,
                        responseType: 'text',
                    };
                }
            },
        );
    } else if (contentType?.includes('multipart/mixed')) {
        convertedPromise = convertResponse(url, body, 'text', result).then(
            function (text) {
                return {
                    response: text,
                    status,
                    headers,
                    size: text.length,
                    url,
                    responseType: 'text',
                };
            },
        );
    } else if (
        contentType &&
        (contentType.includes('image/') || binaryContentTypes[contentType])
    ) {
        convertedPromise = convertResponse(url, body, 'blob', result).then(
            function (blob) {
                return {
                    response: blob,
                    status,
                    headers,
                    size: blob.size,
                    url,
                    responseType: 'blob',
                };
            },
        );
    } else {
        convertedPromise = convertResponse(url, body, 'text', result)
            .then(function (text) {
                return {
                    response: text,
                    status,
                    headers,
                    size: text ? text.length : 0,
                    url,
                    responseType: 'text',
                };
            })
            .catch((error: NetworkError) => {
                // previously threw, so keeping previous behaviour.
                // as below, aim is to delete the whole catch block
                if (error.type === 'convert-response-exception') {
                    return Promise.reject(error);
                }
                // since we guess that it can be interpreted as text, do not fail the promise
                // if we fail to get text
                // Its not known if this case is covering up network errors
                // so we may remove this whole catch block in future.
                // hence logging to work out if/when this is happening
                // ignoring statuses that will result in a rejection, since removing this catch
                // won't change anything.
                if (!statusCausesRejection) {
                    log.warn(
                        LOG_AREA,
                        'Failed to get text on response with no content type',
                        { url, status, error },
                    );
                }

                return {
                    response: undefined,
                    status,
                    headers,
                    size: 0,
                    url,
                };
            });
    }

    if (statusCausesRejection || didHeadersFail) {
        convertedPromise = convertedPromise.then((newResult) => {
            let correlation;
            try {
                correlation = headers.get('x-correlation') || '';
            } catch {
                log.warn(LOG_AREA, 'Failed to get correlation header', { url });
            }

            // Form of correlation header is: {sessionId}#{AppId}#{requestId}#{serverDigits}
            const requestId = correlation?.split('#')[2];

            const logFunction: 'error' | 'info' =
                status > 499 || status < 400 ? 'error' : 'info';

            const isNoStatus = !status;
            const isProxyError = status === 407; // never returned by open api
            const isAkamaiError =
                typeof newResult?.response === 'string' &&
                newResult.response.indexOf('Reference&#32;') > 0;
            let networkErrorType: NetworkErrorType | undefined;

            const isNetworkError =
                isNoStatus || isProxyError || isAkamaiError || didHeadersFail;

            if (isNoStatus) {
                networkErrorType = 'no-status';
            } else if (isProxyError) {
                networkErrorType = 'proxy-error';
            } else if (isAkamaiError) {
                networkErrorType = 'akamai-error';
            } else if (didHeadersFail) {
                networkErrorType = 'headers-get-failure';
            }

            log[logFunction](LOG_AREA, 'Rejected server response', {
                url,
                body,
                status,
                response: newResult?.response,
                requestId: requestId || null,
                isNetworkError,
                networkErrorType,
            });

            return Promise.reject({
                ...newResult,
                isNetworkError,
                networkErrorType,
                url,
                requestId,
            });
        });
    }

    return convertedPromise;
}

function getBody(method: Uppercase<HTTPMethodType>, options?: Options): any {
    // If PATCH without body occurs, create empty payload.
    // Reason: Some proxies and default configs for CDNs like Akamai have issues with accepting PATCH with content-length: 0.
    if (method === 'PATCH' && !options?.body) {
        return {};
    }

    return options?.body;
}

/**
 * Performs a fetch and processes the response.
 * All non 200 responses are converted to rejections. The body can be an object and will be JSON.stringified and the right header added.
 * All responses that contain JSON are converted to objects.
 *
 * @param httMethod - The http method.
 * @param url - The url to fetch.
 * @param options - (optional)
 */
function localFetch<Response = any>(
    httMethod: HTTPMethodType | Uppercase<HTTPMethodType>,
    url: string,
    options?: Options,
): Promise<OAPIRequestResult<Response>> {
    let method = httMethod.toUpperCase() as Uppercase<HTTPMethodType>;
    let body = getBody(method, options);
    const headers = options?.headers || {};
    const cache = options?.cache;
    const credentials = options?.credentials || 'include';
    const useXHttpMethodOverride = options?.useXHttpMethodOverride;
    const signal = options?.signal;

    // encode objects. Batch calls come through as strings.
    if (shouldBeStringified(body)) {
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

    const timerId = window.setTimeout(() => {
        log.warn(LOG_AREA, 'Took more than 30 seconds to get a response', {
            url,
        });
    }, 30000);

    return fetch(url, { headers, method, body, credentials, signal })
        .catch(convertFetchReject.bind(null, url, body, timerId))
        .then(convertFetchSuccess.bind(null, url, body, timerId));
}

function shouldBeStringified(body?: any): body is Record<string, any> {
    return Boolean(
        body && typeof body === 'object' && !isAlreadySupported(body),
    );
}
// Check for handled type: https://fetch.spec.whatwg.org/#bodyinit
// URLSearchParams and ReadableStream are guarded, because they are not supported in IE
// USVString is not handled because it will be typeof "string"
function isAlreadySupported(body: any) {
    return (
        body instanceof window.Blob ||
        body instanceof window.ArrayBuffer ||
        body instanceof window.FormData ||
        (window.URLSearchParams && body instanceof window.URLSearchParams)
    );
}

export default localFetch;
