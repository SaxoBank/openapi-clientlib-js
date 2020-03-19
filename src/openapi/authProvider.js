/**
 * @module saxo/openapi/authProvider
 * @ignore
 */

// -- Local variables section --

import emitter from '../micro-emitter';
import log from '../log';
import { startsWith } from '../utils/string';
import fetch from '../utils/fetch';

const LOG_AREA = 'AuthProvider';

const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_TOKEN_REFRESH_METHOD = 'POST';
const DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_TOKEN = 'token';
const DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_EXPIRES = 'expiry';
const DEFAULT_TOKEN_REFRESH_MARGIN_MS = 0;
const DEFAULT_TOKEN_REFRESH_CREDENTIALS = 'include';
// This should be higher than a possible network delay, high enough that we don't request alot of new tokens, but alot less than a possible
// token expiry and not so high that if a new token is somehow invalid it takes too long to resolve (unlikely).
const TRASH_NEW_TOKEN_DELAY_MS = 10000;

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
    return new Date().getTime() + relativeExpiry * 1000;
}

/**
 * Called when the token has changed.
 */
function createTimerForNextToken() {
    const expiry = this.getExpiry();

    let elapse = expiry - new Date().getTime();

    // If in the past try anyway to refresh token - page can have reload and normally we have some margin for refreshing the token server side
    if (elapse <= 0) {
        this.refreshOpenApiToken();
    } else {
        elapse -= this.tokenRefreshMarginMs;
        if (elapse < 0) {
            log.warn(
                LOG_AREA,
                'token has changed, but expiry is less than the token refresh margin.',
                {
                    expiry,
                    tokenRefreshMarginMs: this.tokenRefreshMarginMs,
                },
            );
            elapse = 0;
        }
        this.tokenRefreshTimerFireTime = Date.now() + elapse;
        this.tokenRefreshTimer = setTimeout(
            this.refreshOpenApiToken.bind(this),
            elapse,
        );
    }
}

function onApiTokenReceived(result) {
    this.state = STATE_WAITING;
    this.retries = 0;
    if (
        !result.response ||
        !result.response[this.tokenRefreshPropertyNameToken]
    ) {
        log.warn(
            LOG_AREA,
            'Token refresh succeeded but no new token was present in response',
            result,
        );
        return;
    }
    const token = result.response[this.tokenRefreshPropertyNameToken];
    const expiry = toAbsoluteTokenExpiry(
        result.response[this.tokenRefreshPropertyNameExpires],
    );
    this.set(token, expiry);
    createTimerForNextToken.call(this);
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
        this.tokenRefreshTimer = setTimeout(
            refreshToken.bind(this),
            this.retryDelayMs,
        );
    } else {
        this.state = STATE_FAILED;
        this.trigger(this.EVENT_TOKEN_REFRESH_FAILED);
    }
}

/**
 * This internal method refreshes the token no matter what and should only
 * be called if we know we are in the correct state to do it.
 */
function refreshToken() {
    if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
    }
    this.trigger(this.EVENT_TOKEN_REFRESH);
    if (this.tokenRefreshUrl) {
        getToken.call(this, this.tokenRefreshUrl);
    }
}

function getToken(url) {
    this.state = STATE_REFRESHING;
    this.lastTokenFetchTime = Date.now();
    const headers = this.tokenRefreshHeaders || {};
    headers['Content-Type'] = headers['Content-Type'] || 'JSON';

    fetch(this.tokenRefreshMethod, url, {
        headers,
        cache: false,
        credentials: this.tokenRefreshCredentials,
    }).then(onApiTokenReceived.bind(this), onApiTokenReceiveFail.bind(this));
}

function addBearer(newToken) {
    if (newToken && !startsWith(newToken, TOKEN_BEARER, false)) {
        newToken = TOKEN_BEARER + newToken;
    }
    return newToken;
}

// -- Exported methods section --
/* eslint-disable complexity */
/**
 * This class builds on top of {@link saxo.openapi.TransportCore} and adds authentication management. You need only
 * construct one or the other, they automatically wrap each other. All of the options from the {@link saxo.openapi.TransportCore}
 * constructor are valid here as well.
 * For authentication management, this class will wait until just before the authentication expires (see tokenRefreshMarginMs)
 * and will refresh the token generating an event which is picked up by some of the other Transports.
 * @class
 * @alias saxo.openapi.TransportAuth
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
 */
function AuthProvider(options) {
    emitter.mixinTo(this);

    let token = addBearer((options && options.token) || null);
    let expiry = (options && options.expiry) || 0;

    // convert to absolute if the value is too small to be absolute
    if (expiry < Date.UTC(2000)) {
        expiry = toAbsoluteTokenExpiry(expiry);
    }

    this.getToken = function() {
        return token;
    };
    this.getExpiry = function() {
        return expiry;
    };
    this.set = function(newToken, newExpiry) {
        token = addBearer(newToken);
        expiry = newExpiry;
    };

    this.tokenRefreshUrl = options && options.tokenRefreshUrl;
    this.tokenRefreshHeaders = options && options.tokenRefreshHeaders;
    this.tokenRefreshCredentials =
        (options && options.tokenRefreshCredentials) ||
        DEFAULT_TOKEN_REFRESH_CREDENTIALS;
    this.tokenRefreshMethod =
        (options && options.tokenRefreshMethod) || DEFAULT_TOKEN_REFRESH_METHOD;
    this.tokenRefreshPropertyNameToken =
        (options && options.tokenRefreshPropertyNameToken) ||
        DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_TOKEN;
    this.tokenRefreshPropertyNameExpires =
        (options && options.tokenRefreshPropertyNameExpires) ||
        DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_EXPIRES;
    this.tokenRefreshMarginMs =
        (options && options.tokenRefreshMarginMs) ||
        DEFAULT_TOKEN_REFRESH_MARGIN_MS;
    this.retryDelayMs =
        (options && options.retryDelayMs) || DEFAULT_RETRY_DELAY_MS;
    this.maxRetryCount =
        (options && options.maxRetryCount) || DEFAULT_MAX_RETRY_COUNT;

    this.state = STATE_WAITING;
    this.retries = 0;

    if (!token && !this.tokenRefreshUrl) {
        throw new Error('No token supplied and no way to get it');
    }

    createTimerForNextToken.call(this);
}
/* eslint-enable complexity */

AuthProvider.prototype.isFetchingNewToken = function() {
    return !(this.state & STATE_WAITING && this.retries === 0);
};

/**
 * Refresh the open api token if we are not already doing so
 */
AuthProvider.prototype.refreshOpenApiToken = function() {
    const isFetching = this.isFetchingNewToken();

    if (isFetching) {
        return;
    }

    refreshToken.call(this);
};

/**
 * Call this method when a 401 unauthenticated is received
 * See also {@link TransportAuth.onTokenInvalid}.
 */
AuthProvider.prototype.tokenRejected = function(expiryOfRejectedToken) {
    const isFetching = this.isFetchingNewToken();

    const currentAuthExpiry = this.getExpiry();
    const now = Date.now();
    let shouldRequest;

    if (!expiryOfRejectedToken) {
        // if we do not have the expiry of the current token, we don't know if we have
        // a different token now than the one causing the error. So we give some leeway
        // in order to not be re-requesting tokens in a loop
        shouldRequest =
            !isFetching &&
            (!this.lastTokenFetchTime ||
                now - this.lastTokenFetchTime > TRASH_NEW_TOKEN_DELAY_MS);

        if (shouldRequest) {
            log.warn(
                LOG_AREA,
                'Request failed with invalid token before time',
                {
                    currentAuthExpiry,
                    now,
                },
            );
        } else {
            log.debug(
                LOG_AREA,
                'Request failed with invalid token - possibly valid due to expired',
                {
                    currentAuthExpiry,
                    now,
                },
            );
        }
    } else {
        // if the current token is the same as when this was sent and its meant to be still valid
        // it means the token is invalid even though its not meant to expire yet
        const isCurrentTokenNotExpiredButRejected =
            currentAuthExpiry > now &&
            expiryOfRejectedToken === currentAuthExpiry;
        const isCurrentTokenExpired = currentAuthExpiry < now;
        // if we are not in an ok waiting state
        shouldRequest =
            (isCurrentTokenNotExpiredButRejected || isCurrentTokenExpired) &&
            !isFetching;

        if (isCurrentTokenNotExpiredButRejected) {
            if (isFetching) {
                log.debug(LOG_AREA, 'Another call failed with invalid token', {
                    currentAuthExpiry,
                    now,
                });
            } else {
                log.error(
                    LOG_AREA,
                    'Unauthorized with a valid token, will fetch a new one',
                    {
                        currentAuthExpiry,
                        now,
                    },
                );
            }
        } else if (isCurrentTokenExpired && !isFetching) {
            const lateBy = now - this.tokenRefreshTimerFireTime;
            log.error(LOG_AREA, 'Token was not refreshed in time', {
                currentAuthExpiry,
                now,
                lateBy,
            });
        } else {
            log.info(
                LOG_AREA,
                'Received an auth error because of an old token.',
                {
                    expiryOfRejectedToken,
                    currentAuthExpiry,
                },
            );
        }
    }

    if (shouldRequest) {
        this.refreshOpenApiToken();
    }
};

/**
 * Type of event that occurs when the token is refreshing.
 */
AuthProvider.prototype.EVENT_TOKEN_REFRESH = 'tokenRefresh';
/**
 * Type of event that occurs when the token is received.
 */
AuthProvider.prototype.EVENT_TOKEN_RECEIVED = 'tokenReceived';
/**
 * Type of event that occurs when the token refresh fails.
 */
AuthProvider.prototype.EVENT_TOKEN_REFRESH_FAILED = 'tokenRefreshFailed';

/**
 * Stops the AuthProvider from refreshing the token.
 */
AuthProvider.prototype.dispose = function() {
    if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
    }
};

// -- Export section --

export default AuthProvider;
