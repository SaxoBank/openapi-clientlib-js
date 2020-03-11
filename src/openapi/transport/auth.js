/**
 * @module saxo/openapi/transport/auth
 * @ignore
 */

// -- Local variables section --

import TransportCore from './core';
import emitter from '../../micro-emitter';
import log from '../../log';
import { startsWith } from '../../utils/string';

const LOG_AREA = 'TransportAuth';

const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_TOKEN_REFRESH_METHOD = 'POST';
const DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_TOKEN = 'token';
const DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_EXPIRES = 'expiry';
const DEFAULT_TOKEN_REFRESH_MARGIN_MS = 0;
const DEFAULT_TOKEN_REFRESH_CREDDENTIALS = 'include';

// Max request limits are used to block infinite loop of authorization requests after transport 401 errors, which my happen if given
// endpoint for whatever reasons constantly returns 401 error status (despite correct fresh authorization token refresh).
const DEFAULT_MAX_AUTH_ERRORS = 3;

// Debounce time in milliseconds.
const DEFAULT_AUTH_ERRORS_CLEANUP_DEBOUNCE = 5000; // ms

const TOKEN_BEARER = 'Bearer ';

const STATE_WAITING = 0x1;
const STATE_REFRESHING = 0x2;
const STATE_FAILED = 0x4;

// -- Local methods section --

/**
 * Returns the absolute timestamp of the expiry based on the current date and time.
 * @param {number|string} relativeExpiry - The time in seconds until the token expires.
 */
function toAbsoluteTokenExpiry(relativeExpiry) {
    relativeExpiry = parseInt(relativeExpiry, 10);
    return (new Date()).getTime() + relativeExpiry * 1000;
}

/**
 * Triggered when the token has changed.
 * @param token
 * @param expiry
 */
function onTokenChanged(token, expiry) {

    let elapse = expiry - (new Date()).getTime();

    // If in the past try anyway to refresh token - page can have reload and normally we have some margin for refreshing the token server side
    if (elapse <= 0) {
        this.isAuthorised = false;
        this.refreshOpenApiToken();
    } else {
        elapse -= this.tokenRefreshMarginMs;
        if (elapse < 0) {
            log.warn(LOG_AREA, 'token has changed, but expiry is less than the token refresh margin.', {
                expiry,
                tokenRefreshMarginMs: this.tokenRefreshMarginMs,
            });
            elapse = 0;
        }
        this.isAuthorised = true;
        this.tokenRefreshTimerFireTime = Date.now() + elapse;
        this.tokenRefreshTimer = setTimeout(this.refreshOpenApiToken.bind(this), elapse);
    }
}

function onApiTokenReceived(result) {
    this.state = STATE_WAITING;
    this.retries = 0;
    if (!result.response || !result.response[this.tokenRefreshPropertyNameToken]) {
        log.warn(LOG_AREA, 'Token refresh succeeded but no new token was present in response', result);
        return;
    }
    const token = result.response[this.tokenRefreshPropertyNameToken];
    const expiry = toAbsoluteTokenExpiry(result.response[this.tokenRefreshPropertyNameExpires]);
    this.auth.set(token, expiry);
    this.trigger(this.EVENT_TOKEN_RECEIVED, token, expiry);
}

function onApiTokenReceiveFail(result) {
    log.warn(LOG_AREA, 'Token refresh failed', result);

    if (result && (result.status === 401 || result.status === 403)) {
        this.trigger(this.EVENT_TOKEN_REFRESH_FAILED);
        this.state = STATE_FAILED;
        return;
    }

    if (this.retries < this.maxRetryCount) {
        this.state = STATE_WAITING;
        this.retries++;
        this.tokenRefreshTimerFireTime = Date.now() + this.retryDelayMs;
        this.tokenRefreshTimer = setTimeout(this.refreshOpenApiToken.bind(this), this.retryDelayMs);
    } else {
        this.state = STATE_FAILED;
        this.trigger(this.EVENT_TOKEN_REFRESH_FAILED);
    }
}

function getToken(url) {
    this.state = STATE_REFRESHING;
    const headers = this.tokenRefreshHeaders || {};
    headers['Content-Type'] = headers['Content-Type'] || 'JSON';

    this.transport.fetch(this.tokenRefreshMethod, url, { headers, cache: false, credentials: this.tokenRefreshCredentials })
        .then(onApiTokenReceived.bind(this), onApiTokenReceiveFail.bind(this));
}

function Auth(initialToken, initialExpiry, onChange) {
    emitter.mixinTo(this);

    function addBearer(newToken) {
        if (newToken && !startsWith(newToken, TOKEN_BEARER, false)) {
            newToken = TOKEN_BEARER + newToken;
        }
        return newToken;
    }

    let token = addBearer(initialToken);
    let expiry = initialExpiry;
    this.getToken = function() {
        return token;
    };
    this.getExpiry = function() {
        return expiry;
    };
    this.set = function(newToken, newExpiry) {

        token = addBearer(newToken);
        expiry = newExpiry;

        onChange(token, expiry);
        this.trigger('tokenReceived');
    };
}

function makeTransportMethod(method) {
    return function(serviceGroup, urlTemplate, templateArgs, options) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers.Authorization = this.auth.getToken();

        return this.transport[method](serviceGroup, urlTemplate, templateArgs, options)
            .catch(onTransportError.bind(this, this.auth.getExpiry()));
    };
}

function onErrorCleanupTimeout() {
    this.authorizationErrorCount = {};
    this.errorCleanupTimoutId = null;
}

function onTransportError(oldTokenExpiry, result) {
    if (result && result.status === 401) {
        const currentAuthExpiry = this.auth.getExpiry();
        const now = Date.now();

        // if the current token is the same as when this was sent and its meant to be still valid
        // it means the token is invalid even though its not meant to expire yet
        const isCurrentTokenNotExpiredButRejected = currentAuthExpiry > now && oldTokenExpiry === currentAuthExpiry;
        const isCurrentTokenExpired = currentAuthExpiry < now;
        // if we are not in an ok waiting state
        const isFetching = !(this.state & STATE_WAITING && this.retries === 0);
        const shouldRequest = (isCurrentTokenNotExpiredButRejected || isCurrentTokenExpired) && !isFetching;
        const urlErrorCount = this.getUrlErrorCount(result.url);

        if (urlErrorCount >= this.maxAuthErrors) {
            // Blocking infinite loop of authorization re-requests which might be caused by invalid
            // behaviour of given endpoint which constantly returns 401 error.
            log.error(LOG_AREA, 'Too many authorization errors occurred withing specified timeframe for specific endpoint.');
            return;
        }

        if (isCurrentTokenNotExpiredButRejected) {
            if (isFetching) {
                log.debug(LOG_AREA, 'Second call failed with invalid token', {
                    currentAuthExpiry,
                    now,
                    result,
                });
            } else {
                log.error(LOG_AREA, 'Unauthorized with a valid token, will fetch a new one', {
                    currentAuthExpiry,
                    now,
                    result,
                });
            }
        } else if (isCurrentTokenExpired && !isFetching) {
            const lateBy = now - this.tokenRefreshTimerFireTime;
            log.error(LOG_AREA, 'Token was not refreshed in time', {
                currentAuthExpiry,
                now,
                lateBy,
            });
        } else {
            log.info(LOG_AREA, 'Received an auth error because of an old token.', {
                oldTokenExpiry,
                currentAuthExpiry,
            });
        }

        if (shouldRequest) {
            this.incrementErrorCounter(result.url);
            this.debounceErrorCounterCleanup();
            this.refreshOpenApiToken();
        }
    }
    throw result;
}

// -- Exported methods section --

/**
 * This class builds on top of {@link saxo.openapi.TransportCore} and adds authentication management. You need only
 * construct one or the other, they automatically wrap each other. All of the options from the {@link saxo.openapi.TransportCore}
 * constructor are valid here as well.
 * For authentication management, this class will wait until just before the authentication expires (see tokenRefreshMarginMs)
 * and will refresh the token generating an event which is picked up by some of the other Transports.
 * @class
 * @alias saxo.openapi.TransportAuth
 * @param {string} baseUrl - The base url used for all open api requests. This should be an absolute URL.
 * @param {Object} [options] - Options for auth and for the core transport. See Transport.
 * @param {string} [options.language] - The language sent as a header if not overridden.
 * @param {boolean} [options.defaultCache=true] - Sets the default caching behaviour if not overridden on a call.
 * @param {string} [options.tokenRefreshUrl] - The url for refreshing the token.
 * @param {Object.<string, string>} [options.tokenRefreshHeaders] - Any headers to be included in the token refresh call.
 *          It should be the same format as other calls.
 *          The object key names are the header names and the values the header values.
 * @param {string} [options.tokenRefreshCredentials="include"] - The credentials option passed to fetch.
 * @param {string} [options.tokenRefreshMethod="POST"] - The http method for refreshing the token e.g. "POST" or "GET" etc.
 * @param {number} [options.tokenRefreshMarginMs=0] - The number of ms that the refresh call should be done early.
 *          e.g. if this is 1000 it will be refreshed 1000 ms before the token expires.
 * @param {string} [options.tokenRefreshPropertyNameToken="token"] - The property name of the token after doing a refresh.
 * @param {string} [options.tokenRefreshPropertyNameExpires="expiry"] - The property name of the relative expiry after doing a refresh.
 * @param {string} [options.token] - The token to use for authentication.
 * @param {string|number} [options.expiry] - The expiry of that token, assumed to be absolute.
 * @param {number} [options.retryDelayMs] - The delay before retrying auth
 * @param {number} [options.maxRetryCount] - The maximum number of times to retry the auth url
 * @param {number} [options.maxAuthErrors] - The maximum number of authorization errors that
 *          can occur for specific endpoint within specific timeframe.
 * @param {number} [options.authErrorsCleanupDebounce] - The debounce timeout (in ms) used for clearing of authorization errors count.
 */
function TransportAuth(baseUrl, options) { // eslint-disable-line complexity

    emitter.mixinTo(this);

    this.tokenRefreshUrl = options && options.tokenRefreshUrl;
    this.tokenRefreshHeaders = options && options.tokenRefreshHeaders;
    this.tokenRefreshCredentials = options && options.tokenRefreshCredentials || DEFAULT_TOKEN_REFRESH_CREDDENTIALS;
    this.tokenRefreshMethod = options && options.tokenRefreshMethod || DEFAULT_TOKEN_REFRESH_METHOD;
    this.tokenRefreshPropertyNameToken = options && options.tokenRefreshPropertyNameToken || DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_TOKEN;
    this.tokenRefreshPropertyNameExpires = options && options.tokenRefreshPropertyNameExpires || DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_EXPIRES;
    this.tokenRefreshMarginMs = options && options.tokenRefreshMarginMs || DEFAULT_TOKEN_REFRESH_MARGIN_MS;
    this.retryDelayMs = options && options.retryDelayMs || DEFAULT_RETRY_DELAY_MS;
    this.maxRetryCount = options && options.maxRetryCount || DEFAULT_MAX_RETRY_COUNT;
    this.maxAuthErrors = options && options.maxAuthErrors || DEFAULT_MAX_AUTH_ERRORS;
    this.authErrorsCleanupDebounce = options && options.authErrorsCleanupDebounce || DEFAULT_AUTH_ERRORS_CLEANUP_DEBOUNCE;

    this.transport = new TransportCore(baseUrl, options);
    this.state = STATE_WAITING;
    this.retries = 0;

    // Map of authorization error counts per endpoint/url.
    this.authorizationErrorCount = {};

    const token = options && options.token || null;
    let expiry = options && options.expiry || 0;
    if (expiry === 0) {
        expiry = toAbsoluteTokenExpiry(expiry);
    }

    if (!token && !this.tokenRefreshUrl) {
        throw new Error('No token supplied and no way to get it');
    }

    this.auth = new Auth(token, expiry, onTokenChanged.bind(this));
    onTokenChanged.call(this, token, expiry);
}

/**
 * Type of event that occurs when the token is refreshing.
 */
TransportAuth.prototype.EVENT_TOKEN_REFRESH = 'tokenRefresh';
/**
 * Type of event that occurs when the token is received.
 */
TransportAuth.prototype.EVENT_TOKEN_RECEIVED = 'tokenReceived';
/**
 * Type of event that occurs when the token refresh fails.
 */
TransportAuth.prototype.EVENT_TOKEN_REFRESH_FAILED = 'tokenRefreshFailed';

/**
 * Performs a authenticated get request.
 * @see {@link saxo.openapi.TransportCore#get}
 * @function
 */
TransportAuth.prototype.get = makeTransportMethod('get');

/**
 * Performs a authenticated put request.
 * @see {@link saxo.openapi.TransportCore#put}
 * @function
 */
TransportAuth.prototype.put = makeTransportMethod('put');

/**
 * Performs a authenticated post request.
 * @see {@link saxo.openapi.TransportCore#post}
 * @function
 */
TransportAuth.prototype.post = makeTransportMethod('post');

/**
 * Performs a authenticated delete request.
 * @see {@link saxo.openapi.TransportCore#delete}
 * @function
 */
TransportAuth.prototype.delete = makeTransportMethod('delete');

/**
 * Performs a authenticated delete request.
 * @see {@link saxo.openapi.TransportCore#patch}
 * @function
 */
TransportAuth.prototype.patch = makeTransportMethod('patch');

/**
 * Performs a authenticated delete request.
 * @see {@link saxo.openapi.TransportCore#head}
 * @function
 */
TransportAuth.prototype.head = makeTransportMethod('head');

/**
 * Performs a authenticated delete request.
 * @see {@link saxo.openapi.TransportCore#options}
 * @function
 */
TransportAuth.prototype.options = makeTransportMethod('options');

/**
 * Refresh the open api token if we are not already doing so
 */
TransportAuth.prototype.checkAuthExpiry = function() {
    const isFetching = !(this.state & STATE_WAITING && this.retries === 0);
    if (!isFetching) {
        this.refreshOpenApiToken();
    }
};

/**
 * Forces a refresh of the open api token
 * This will refresh even if a refresh is already in progress, so only call this if you need a forced refresh.
 * See also {@link TransportAuth.onTokenInvalid}.
 */
TransportAuth.prototype.refreshOpenApiToken = function() {
    if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
    }
    this.trigger(this.EVENT_TOKEN_REFRESH);
    if (this.tokenRefreshUrl) {
        getToken.call(this, this.tokenRefreshUrl);
    }
};

/**
 * Run debounced cleanup of error counter map
 */
TransportAuth.prototype.debounceErrorCounterCleanup = function() {
    if (this.errorCleanupTimoutId) {
        clearTimeout(this.errorCleanupTimoutId);
    }

    this.errorCleanupTimoutId = setTimeout(onErrorCleanupTimeout.bind(this), this.authErrorsCleanupDebounce);
};

/**
 * Increment error counter for specific url/endpoint.
 * @param {string} url - The url/endpoint for which error count is incremented.
 */
TransportAuth.prototype.incrementErrorCounter = function(url) {
    if (this.authorizationErrorCount.hasOwnProperty(url)) {
        this.authorizationErrorCount[url] = this.authorizationErrorCount[url] + 1;
    } else {
        this.authorizationErrorCount[url] = 1;
    }
};

/**
 * Get error count for specific url/endpoint
 * @param {string} url - The url/endpoint for which error count is returned.
 * @returns {number} The number of errors
 */
TransportAuth.prototype.getUrlErrorCount = function(url) {
    if (this.authorizationErrorCount.hasOwnProperty(url)) {
        return this.authorizationErrorCount[url];
    }

    return 0;
};

/**
 * Stops the transport from refreshing the token.
 */
TransportAuth.prototype.dispose = function() {
    clearTimeout(this.errorCleanupTimoutId);
    this.errorCleanupTimoutId = null;
    this.authorizationErrorCount = {};

    if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
    }
    this.transport.dispose();
};

// -- Export section --

export default TransportAuth;
