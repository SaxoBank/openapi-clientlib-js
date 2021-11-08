import MicroEmitter from '../micro-emitter';
import log from '../log';
import { startsWith } from '../utils/string';
import fetch from '../utils/fetch';
import type { OAPIRequestResult, HTTPMethodType, NetworkError } from '../types';

const LOG_AREA = 'AuthProvider';

const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_TOKEN_REFRESH_METHOD = 'post';
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

/**
 * Returns the absolute timestamp of the expiry based on the current date and time.
 * @param relativeExpiry - The time in seconds until the token expires.
 */
function toAbsoluteTokenExpiry(relativeExpiry: number | string) {
    const relativeExpiryInt =
        typeof relativeExpiry === 'string'
            ? parseInt(relativeExpiry, 10)
            : relativeExpiry;
    return new Date().getTime() + relativeExpiryInt * 1000;
}

function addBearer(newToken: string | null) {
    if (newToken && !startsWith(newToken, TOKEN_BEARER, false)) {
        newToken = TOKEN_BEARER + newToken;
    }
    return newToken;
}

type Options = {
    /**
     * The token to use for authentication.
     */
    token?: string | null;
    /**
     * The expiry of that token, assumed to be absolute.
     */
    expiry?: number;
    /**
     * The url for refreshing the token.
     */
    tokenRefreshUrl?: string;
    /**
     * Any headers to be included in the token refresh call. It should be the same format as other calls.
     * The object key names are the header names and the values the header values.
     */
    tokenRefreshHeaders?: Record<string, string>;
    /**
     * The credentials option passed to fetch.
     */
    tokenRefreshCredentials?: RequestCredentials;
    /**
     *  The http method for refreshing the token e.g. "POST" or "GET" etc.
     */
    tokenRefreshMethod?: HTTPMethodType;
    /**
     * The property name of the token after doing a refresh.
     */
    tokenRefreshPropertyNameToken?: string;
    /**
     * The property name of the relative expiry after doing a refresh.
     */
    tokenRefreshPropertyNameExpires?: string;
    /**
     * The number of ms that the refresh call should be done early.
     * e.g. if this is 1000 it will be refreshed 1000 ms before the token expires.
     */
    tokenRefreshMarginMs?: number;
    /**
     * The delay before retrying auth
     */
    retryDelayMs?: number;
    /**
     * The maximum number of times to retry the auth url
     */
    maxRetryCount?: number;
};

const EVENT_TOKEN_REFRESH = 'tokenRefresh' as const;
const EVENT_TOKEN_RECEIVED = 'tokenReceived' as const;
const EVENT_TOKEN_REFRESH_FAILED = 'tokenRefreshFailed' as const;

type EmittedEvents = {
    [EVENT_TOKEN_REFRESH]: () => void;
    [EVENT_TOKEN_RECEIVED]: (token?: string, refresh?: number) => void;
    [EVENT_TOKEN_REFRESH_FAILED]: (result?: OAPIRequestResult) => void;
};

/**
 * This class builds on top of {@link TransportCore} and adds authentication management. You need only
 * construct one or the other, they automatically wrap each other. All of the options from the {@link TransportCore}
 * class are valid here as well.
 * For authentication management, this class will wait until just before the authentication expires (see tokenRefreshMarginMs)
 * and will refresh the token generating an event which is picked up by some of the other Transports.
 */
class AuthProvider extends MicroEmitter<EmittedEvents> {
    private expiry = 0;
    private token: string | null = null;
    tokenRefreshUrl?: string;
    tokenRefreshHeaders?: Record<string, string> = {};
    tokenRefreshCredentials: RequestCredentials =
        DEFAULT_TOKEN_REFRESH_CREDENTIALS;
    tokenRefreshMethod: HTTPMethodType = DEFAULT_TOKEN_REFRESH_METHOD;
    tokenRefreshPropertyNameToken = DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_TOKEN;
    tokenRefreshPropertyNameExpires =
        DEFAULT_TOKEN_REFRESH_PROPERTY_NAME_EXPIRES;
    tokenRefreshMarginMs = DEFAULT_TOKEN_REFRESH_MARGIN_MS;
    retryDelayMs = DEFAULT_RETRY_DELAY_MS;
    maxRetryCount = DEFAULT_MAX_RETRY_COUNT;
    state = 1;
    retries = 0;
    tokenRefreshTimerFireTime = 0;
    tokenRefreshTimer: number | null = null;
    lastTokenFetchTime = 0;
    // Type of event that occurs when the token is refreshing.
    EVENT_TOKEN_REFRESH = EVENT_TOKEN_REFRESH;
    // Type of event that occurs when the token is received.
    EVENT_TOKEN_RECEIVED = EVENT_TOKEN_RECEIVED;
    // Type of event that occurs when the token refresh fails.
    EVENT_TOKEN_REFRESH_FAILED = EVENT_TOKEN_REFRESH_FAILED;

    constructor(options: Options) {
        super();
        if (!options?.token && !options?.tokenRefreshUrl) {
            throw new Error('No token supplied and no way to get it');
        }

        if (options?.expiry) {
            this.expiry = options.expiry;
        }

        this.token = addBearer(options.token || null);

        // convert to absolute if the value is too small to be absolute
        if (this.expiry < Date.UTC(2000, 0)) {
            this.expiry = toAbsoluteTokenExpiry(this.expiry);
        }

        this.tokenRefreshUrl = options.tokenRefreshUrl;
        this.tokenRefreshHeaders = options.tokenRefreshHeaders;

        if (options.tokenRefreshCredentials) {
            this.tokenRefreshCredentials = options.tokenRefreshCredentials;
        }
        if (options.tokenRefreshMethod) {
            this.tokenRefreshMethod = options.tokenRefreshMethod;
        }
        if (options.tokenRefreshPropertyNameToken) {
            this.tokenRefreshPropertyNameToken =
                options.tokenRefreshPropertyNameToken;
        }
        if (options.tokenRefreshPropertyNameExpires) {
            this.tokenRefreshPropertyNameExpires =
                options.tokenRefreshPropertyNameExpires;
        }

        if (options.tokenRefreshMarginMs) {
            this.tokenRefreshMarginMs = options.tokenRefreshMarginMs;
        }
        if (options.retryDelayMs) {
            this.retryDelayMs = options.retryDelayMs;
        }
        if (options.maxRetryCount) {
            this.maxRetryCount = options.maxRetryCount;
        }

        this.state = STATE_WAITING;
        this.retries = 0;

        this.createTimerForNextToken();
    }

    /**
     * This internal method refreshes the token no matter what and should only
     * be called if we know we are in the correct state to do it.
     */
    private refreshToken = () => {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }
        this.trigger(this.EVENT_TOKEN_REFRESH);
        if (this.tokenRefreshUrl) {
            this.fetchToken(this.tokenRefreshUrl);
        }
    };

    private fetchToken(url: string) {
        this.state = STATE_REFRESHING;
        this.lastTokenFetchTime = Date.now();
        const headers = this.tokenRefreshHeaders || {};
        headers['Content-Type'] = headers['Content-Type'] || 'JSON';

        fetch(this.tokenRefreshMethod, url, {
            headers,
            cache: false,
            credentials: this.tokenRefreshCredentials,
        }).then(this.onApiTokenReceived, this.onApiTokenReceiveFail);
    }

    private isValidTokenResponse(
        response?: string | Blob | Record<string, unknown>,
    ): response is Record<string, string | number> {
        if (
            response &&
            typeof response !== 'string' &&
            !(response instanceof window.Blob) &&
            response[this.tokenRefreshPropertyNameToken]
        ) {
            return true;
        }

        return false;
    }

    private onApiTokenReceived = (result: OAPIRequestResult) => {
        this.state = STATE_WAITING;
        this.retries = 0;

        if (!this.isValidTokenResponse(result.response)) {
            log.error(
                LOG_AREA,
                'Token refresh succeeded but no new token was present in response',
                result,
            );
            return;
        }
        const token = result.response[
            this.tokenRefreshPropertyNameToken
        ] as string;
        const expiry = toAbsoluteTokenExpiry(
            result.response[this.tokenRefreshPropertyNameExpires],
        );
        this.set(token, expiry);
        this.createTimerForNextToken();
        this.trigger(this.EVENT_TOKEN_RECEIVED, token, expiry);
    };

    private onApiTokenReceiveFail = (
        result: OAPIRequestResult | NetworkError,
    ) => {
        const currentExpiry = this.getExpiry();
        const isAuthenticationError =
            result &&
            (result.status === 401 ||
                result.status === 403 ||
                result.status === 407);

        // we only log this as an error if its abnormal e.g. it is not
        //   1. a network error
        //   2. a session expiry - if the current time is after the current expiry
        //      then the token already expired, which should only happen if the session
        //      was paused (e.g. app in background in phone, laptop hibernated)
        if (
            result.isNetworkError ||
            (isAuthenticationError &&
                (!currentExpiry || Date.now() > currentExpiry))
        ) {
            log.info(LOG_AREA, 'Token refresh failed', result);
        } else {
            log.error(LOG_AREA, 'Token refresh failed', result);
        }

        if (isAuthenticationError) {
            // status is not present on NetworkError
            this.trigger(
                this.EVENT_TOKEN_REFRESH_FAILED,
                result as OAPIRequestResult,
            );
            this.state = STATE_FAILED;
            return;
        }

        if (this.retries < this.maxRetryCount) {
            this.state = STATE_WAITING;
            this.retries++;
            this.tokenRefreshTimerFireTime = Date.now() + this.retryDelayMs;
            this.tokenRefreshTimer = window.setTimeout(
                this.refreshToken,
                this.retryDelayMs,
            );
        } else {
            this.state = STATE_FAILED;
            this.trigger(this.EVENT_TOKEN_REFRESH_FAILED);
        }
    };

    /**
     * Called when the token has changed.
     */
    createTimerForNextToken() {
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
                    'Token has changed, but expiry is less than the token refresh margin.',
                    {
                        expiry,
                        tokenRefreshMarginMs: this.tokenRefreshMarginMs,
                    },
                );
                elapse = 0;
            }
            this.tokenRefreshTimerFireTime = Date.now() + elapse;
            this.tokenRefreshTimer = window.setTimeout(
                this.refreshOpenApiToken,
                elapse,
            );
        }
    }

    getToken() {
        return this.token;
    }

    getExpiry() {
        return this.expiry;
    }

    set(newToken: string, newExpiry: number) {
        this.token = addBearer(newToken);
        this.expiry = newExpiry;
    }

    isFetchingNewToken() {
        return !(this.state & STATE_WAITING && this.retries === 0);
    }

    /**
     * Refresh the open api token if we are not already doing so
     */
    refreshOpenApiToken = () => {
        const isFetching = this.isFetchingNewToken();

        if (isFetching) {
            return;
        }

        this.refreshToken();
    };

    /**
     * Call this method when a 401 unauthenticated is received
     */
    tokenRejected(expiryOfRejectedToken?: number) {
        const isFetching = this.isFetchingNewToken();

        const currentAuthExpiry = this.getExpiry();
        const now = Date.now();
        let shouldRequest;

        if (!expiryOfRejectedToken) {
            const lastTokenFetchTime = this.lastTokenFetchTime;
            // if we do not have the expiry of the current token, we don't know if we have
            // a different token now than the one causing the error. So we give some leeway
            // in order to not be re-requesting tokens in a loop
            shouldRequest =
                !isFetching &&
                (!lastTokenFetchTime ||
                    now - lastTokenFetchTime > TRASH_NEW_TOKEN_DELAY_MS);

            if (shouldRequest) {
                log.warn(
                    LOG_AREA,
                    'Request failed with invalid token and we are guessing we need a new one',
                    {
                        lastTokenFetchTime,
                        currentAuthExpiry,
                        now,
                        isFetching,
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

            shouldRequest =
                (isCurrentTokenNotExpiredButRejected ||
                    isCurrentTokenExpired) &&
                !isFetching;

            if (isCurrentTokenNotExpiredButRejected) {
                if (isFetching) {
                    log.debug(
                        LOG_AREA,
                        'Another call failed with invalid token',
                        {
                            currentAuthExpiry,
                            now,
                        },
                    );
                } else {
                    log.error(
                        LOG_AREA,
                        'Unauthorized with a valid token, will fetch a new one',
                        {
                            expiryOfRejectedToken,
                            currentAuthExpiry,
                            now,
                        },
                    );
                }
            } else if (isCurrentTokenExpired && !isFetching) {
                const lateBy = now - this.tokenRefreshTimerFireTime;
                log.debug(LOG_AREA, 'Token was not refreshed in time', {
                    currentAuthExpiry,
                    now,
                    lateBy,
                });
            } else {
                log.debug(
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
    }

    /**
     * Stops the AuthProvider from refreshing the token.
     */
    dispose() {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
        }
    }
}

export default AuthProvider;
