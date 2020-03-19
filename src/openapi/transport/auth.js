/**
 * @module saxo/openapi/transport/auth
 * @ignore
 */

// -- Local variables section --

import TransportCore from './core';
import log from '../../log';

const LOG_AREA = 'TransportAuth';

// Max request limits are used to block infinite loop of authorization requests after transport 401 errors, which my happen if given
// endpoint for whatever reasons constantly returns 401 error status (despite correct fresh authorization token refresh).
const DEFAULT_MAX_AUTH_ERRORS = 3;

// Debounce time in milliseconds.
const DEFAULT_AUTH_ERRORS_CLEANUP_DEBOUNCE = 5000; // ms

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

function onErrorCleanupTimeout() {
    this.authorizationErrorCount = {};
    this.errorCleanupTimoutId = null;
}

function onTransportError(oldTokenExpiry, result) {
    if (result && result.status === 401) {
        const urlErrorCount = this.getUrlErrorCount(result.url);

        if (urlErrorCount >= this.maxAuthErrors) {
            // Blocking infinite loop of authorization re-requests which might be caused by invalid
            // behaviour of given endpoint which constantly returns 401 error.
            log.error(
                LOG_AREA,
                'Too many authorization errors occurred within specified timeframe for specific endpoint.',
                result.url,
            );
            return;
        }

        log.debug(LOG_AREA, 'Authentication failure', result);

        this.incrementErrorCounter(result.url);
        this.debounceErrorCounterCleanup();
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
 * @param {number} [options.authErrorsCleanupDebounce] - The debounce timeout (in ms) used for clearing of authorization errors count.
 * @param {number} [options.maxAuthErrors] - The maximum number of authorization errors that
 *          can occur for specific endpoint within specific timeframe.
 */
function TransportAuth(baseUrl, authProvider, options) {
    if (!authProvider) {
        throw new Error('transport auth created without a auth provider');
    }

    this.authErrorsCleanupDebounce =
        (options && options.authErrorsCleanupDebounce) ||
        DEFAULT_AUTH_ERRORS_CLEANUP_DEBOUNCE;
    this.maxAuthErrors =
        (options && options.maxAuthErrors) || DEFAULT_MAX_AUTH_ERRORS;

    this.transport = new TransportCore(baseUrl, options);

    // Map of authorization error counts per endpoint/url.
    this.authorizationErrorCount = {};

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
 * Run debounced cleanup of error counter map
 */
TransportAuth.prototype.debounceErrorCounterCleanup = function() {
    if (this.errorCleanupTimoutId) {
        clearTimeout(this.errorCleanupTimoutId);
    }

    this.errorCleanupTimoutId = setTimeout(
        onErrorCleanupTimeout.bind(this),
        this.authErrorsCleanupDebounce,
    );
};

/**
 * Increment error counter for specific url/endpoint.
 * @param {string} url - The url/endpoint for which error count is incremented.
 */
TransportAuth.prototype.incrementErrorCounter = function(url) {
    if (this.authorizationErrorCount.hasOwnProperty(url)) {
        this.authorizationErrorCount[url] += 1;
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

    this.transport.dispose();
};

// -- Export section --

export default TransportAuth;
