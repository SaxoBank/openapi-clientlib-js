/**
 * @module saxo/openapi/transport/auth
 * @ignore
 */

// -- Local variables section --

import TransportCore from './core';
import log from '../../log';

const LOG_AREA = 'TransportAuth';

// The default period within which errors on different tokens
// cause an endpoint auth errors to be ignored.
const DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD = 30000; // ms

// -- Local methods section --

function makeTransportMethod(method) {
    return function(serviceGroup, urlTemplate, templateArgs, options) {
        const newOptions = {
            ...options,
            headers: {
                ...(options && options.headers),
                Authorization: this.authProvider.getToken(),
            },
        };

        return this.transport[method](
            serviceGroup,
            urlTemplate,
            templateArgs,
            newOptions,
        ).catch(onTransportError.bind(this, this.authProvider.getExpiry()));
    };
}

function onTransportError(oldTokenExpiry, result) {
    if (result && result.status === 401) {
        this.addAuthError(result.url, oldTokenExpiry);
        this.cleanupAuthErrors();
        const areUrlAuthErrorsProblematic = this.areUrlAuthErrorsProblematic(
            result.url,
            oldTokenExpiry,
        );

        if (areUrlAuthErrorsProblematic) {
            // Blocking infinite loop of authorization re-requests which might be caused by invalid
            // behaviour of given endpoint which constantly returns 401 error.
            log.error(
                LOG_AREA,
                'Too many authorization errors occurred for different tokens within a specified timeframe for a specific endpoint',
                result.url,
            );
            return;
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
 * @param {number} [options.authErrorsDebouncePeriod] - The period within which errors on different tokens cause an endpoint auth errors to be ignored.
 */
function TransportAuth(baseUrl, authProvider, options) {
    if (!authProvider) {
        throw new Error('transport auth created without a auth provider');
    }

    this.authErrorsDebouncePeriod =
        (options && options.authErrorsDebouncePeriod) ||
        DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD;

    this.transport = new TransportCore(baseUrl, options);

    // Map of authorization error counts per endpoint/url.
    this.authorizationErrors = {};

    this.authProvider = authProvider;
}

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
 * Cleanup of error counter map
 */
TransportAuth.prototype.cleanupAuthErrors = function() {
    const cleanThoseBefore = Date.now() - this.authErrorsDebouncePeriod;

    for (const url in this.authorizationErrors) {
        if (this.authorizationErrors.hasOwnProperty(url)) {
            const newEntries = [];
            for (let i = 0; i < this.authorizationErrors[url].length; i++) {
                if (this.authorizationErrors[url][i].added > cleanThoseBefore) {
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
};

/**
 * Add a authentication error to the error map
 * @param {string} url - The url/endpoint at which a auth error occurred
 * @param {number} authExpiry - The expiry of the token that was rejected
 */
TransportAuth.prototype.addAuthError = function(url, authExpiry) {
    if (this.authorizationErrors.hasOwnProperty(url)) {
        this.authorizationErrors[url].push({
            authExpiry,
            added: Date.now(),
        });
    } else {
        this.authorizationErrors[url] = [{ authExpiry, added: Date.now() }];
    }
};

/**
 * Returns if the auth errors for a url are problematic
 * @param {string} url - The url/endpoint to check
 * @param {number} authExpiry - The auth expiry of the request to check
 * @returns {boolean} Whether it is problematic
 */
TransportAuth.prototype.areUrlAuthErrorsProblematic = function(
    url,
    authExpiry,
) {
    if (this.authorizationErrors.hasOwnProperty(url)) {
        for (let i = 0; i < this.authorizationErrors[url].length; i++) {
            if (this.authorizationErrors[url][i].authExpiry !== authExpiry) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Stops the transport from refreshing the token.
 */
TransportAuth.prototype.dispose = function() {
    clearTimeout(this.errorCleanupTimoutId);
    this.errorCleanupTimoutId = null;
    this.authorizationErrors = {};

    this.transport.dispose();
};

// -- Export section --

export default TransportAuth;
