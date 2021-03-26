/**
 * @module saxo/openapi/transport/auth
 * @ignore
 */

// -- Local variables section --

import log from '../../log';
import type AuthProvider from '../authProvider';
import TransportCore from './core';

const LOG_AREA = 'TransportAuth';

// The default period within which errors on different tokens
// cause an endpoint auth errors to be ignored.
const DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD = 30000; // ms

// -- Local methods section --

type Methods = 'get' | 'put' | 'post' | 'delete' | 'patch' | 'options' | 'head';

type Options = {
    authErrorsDebouncePeriod?: number;
};

function makeTransportMethod(this: TransportAuth, method: Methods) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;
    return function (
        servicePath: string,
        urlTemplate: string,
        templateArgs: string[],
        options: any,
    ) {
        const newOptions = {
            ...options,
            headers: {
                ...(options && options.headers),
                Authorization: that.authProvider.getToken(),
            },
        };

        return that.transport[method](
            servicePath,
            urlTemplate,
            templateArgs,
            newOptions,
        ).catch(
            onTransportError.bind(
                that,
                that.authProvider.getExpiry(),
                Date.now(),
            ),
        );
    };
}

function onTransportError(
    this: TransportAuth,
    oldTokenExpiry: number,
    timeRequested: number,
    result: any,
) {
    if (result && result.status === 401) {
        this.addAuthError(result.url, oldTokenExpiry, timeRequested);
        this.cleanupAuthErrors();
        const areUrlAuthErrorsProblematic = this.areUrlAuthErrorsProblematic(
            result.url,
            oldTokenExpiry,
        );

        if (areUrlAuthErrorsProblematic) {
            // Blocking infinite loop of authorization re-requests which might be caused by invalid
            // behavior of given endpoint which constantly returns 401 error.
            log.error(
                LOG_AREA,
                'Too many authorization errors occurred for different tokens within a specified time-frame for a specific endpoint',
                result.url,
            );
            throw {
                message: 'Auth overload',
                isNetworkError: false,
            };
        }

        log.debug(LOG_AREA, 'Authentication failure', result);

        this.authProvider.tokenRejected(oldTokenExpiry);
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
 * @param {Object} authProvider - a AuthProvider to get the token from
 * @param {Object} [options] - Options for auth and for the core transport. See Transport.
 * @param {string} [options.language] - The language sent as a header if not overridden.
 * @param {boolean} [options.defaultCache=true] - Sets the default caching behaviour if not overridden on a call.
 * @param {number} [options.authErrorsDebouncePeriod] - The period within which errors on different tokens cause an endpoint auth errors
 *                                                      to be ignored.
 */
class TransportAuth {
    authErrorsDebouncePeriod = DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD;
    authorizationErrors: Record<
        string,
        Array<{ authExpiry: number; added: number }>
    > = {};

    // its a timeout id
    errorCleanupTimeOutId: any;
    // needs to map with transport core interface
    transport: any;
    authProvider: AuthProvider;
    constructor(
        baseUrl: string,
        authProvider: AuthProvider,
        options?: Options,
    ) {
        if (!authProvider) {
            throw new Error('transport auth created without a auth provider');
        }

        if (options?.authErrorsDebouncePeriod) {
            this.authErrorsDebouncePeriod = options.authErrorsDebouncePeriod;
        }

        // @ts-ignore fix-me
        this.transport = new TransportCore(baseUrl, options);

        // Map of authorization error counts per endpoint/url.
        this.authProvider = authProvider;
    }

    get = makeTransportMethod.call(this, 'get'); // Performs a authenticated get request.
    put = makeTransportMethod.call(this, 'put'); // Performs a authenticated put request.
    post = makeTransportMethod.call(this, 'post'); // Performs a authenticated post request.
    delete = makeTransportMethod.call(this, 'delete'); // Performs a authenticated delete request.
    patch = makeTransportMethod.call(this, 'patch'); // Performs a authenticated patch request.
    head = makeTransportMethod.call(this, 'head');
    options = makeTransportMethod.call(this, 'options');

    // Cleanup of error counter map
    cleanupAuthErrors() {
        const cleanThoseBefore = Date.now() - this.authErrorsDebouncePeriod;

        for (const url in this.authorizationErrors) {
            if (this.authorizationErrors.hasOwnProperty(url)) {
                const newEntries = [];
                for (let i = 0; i < this.authorizationErrors[url].length; i++) {
                    if (
                        this.authorizationErrors[url][i].added >
                        cleanThoseBefore
                    ) {
                        newEntries.push(this.authorizationErrors[url][i]);
                    }
                }
                if (newEntries.length) {
                    this.authorizationErrors[url] = newEntries;
                } else {
                    delete this.authorizationErrors[url];
                }
            }
        }
    }

    /**
     * Add a authentication error to the error map
     * @param {string} url - The url/endpoint at which a auth error occurred
     * @param {number} authExpiry - The expiry of the token that was rejected
     * @param {number} timeRequested - The time the request was made
     */
    addAuthError(url: string, authExpiry: number, timeRequested: number) {
        if (this.authorizationErrors.hasOwnProperty(url)) {
            this.authorizationErrors[url].push({
                authExpiry,
                added: timeRequested,
            });
        } else {
            this.authorizationErrors[url] = [
                { authExpiry, added: timeRequested },
            ];
        }
    }

    /**
     * Returns if the auth errors for a url are problematic
     * @param {string} url - The url/endpoint to check
     * @param {number} authExpiry - The auth expiry of the request to check
     * @returns {boolean} Whether it is problematic
     */
    areUrlAuthErrorsProblematic(url: string, authExpiry: number) {
        if (this.authorizationErrors.hasOwnProperty(url)) {
            for (let i = 0; i < this.authorizationErrors[url].length; i++) {
                if (
                    this.authorizationErrors[url][i].authExpiry !== authExpiry
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    //  Stops the transport from refreshing the token.
    dispose() {
        clearTimeout(this.errorCleanupTimeOutId);
        this.errorCleanupTimeOutId = null;
        this.authorizationErrors = {};

        this.transport.dispose();
    }
}

export default TransportAuth;
