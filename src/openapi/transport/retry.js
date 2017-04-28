/**
 * @module saxo/openapi/transport/retry
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

function transportMethod(method) {
    return function() {
        // checking if http method call should be handled by RetryTransport
        if (this.methods[method] && (this.methods[method].retryLimit > 0 || this.methods[method].retryTimeouts)) {

            return new Promise((resolve, reject) => {

                const transportCall = {
                    method,
                    args: arguments,
                    resolve,
                    reject,
                    retryCount: 0,
                    retryTimer: null,
                };

                this.sendTransportCall(transportCall);
            });
        }
            // calls underlying transport http method
        return this.transport[method].apply(this.transport, arguments);

    };
}

// -- Exported methods section --

/**
 * TransportRetry wraps a transport class to allow the retrying of failed transport calls, so the calls are resent after a timeout.
 * @class
 * @alias saxo.openapi.TransportRetry
 * @param {Transport} transport - The transport to wrap.
 * @param {object} [options] - Settings options. Define retry timeout, http methods to retry and max retry limit
 *      per http method type. If not given then calls will run with underlying transport without retry logic.
 * @param {number} [options.retryTimeout=0] - The number of ms after that the retry calls should be done.
 * @param {object.<string,object>} [options.methods] - Http methods that should retry. For each method provide an object with `retryLimit` parameter.
 * @example
 * // Constructor with parameters
 * var transportRetry = new TransportRetry(transport, {
 *      retryTimeout:10000,
 *      methods:{
 *          'delete':{ retryLimit:3 },
 *          'post':{ retryTimeouts: [1000, 1000, 2000, 3000, 5000], statuses: [504] },
 *      }
 * });
 */
function TransportRetry(transport, options) {
    if (!transport) {
        throw new Error('Missing required parameter: transport in TransportRetry');
    }
    this.retryTimeout = (options && options.retryTimeout > 0) ? options.retryTimeout : 0;
    this.methods = (options && options.methods) ? options.methods : {};
    this.transport = transport;
    this.failedCalls = [];
    this.individualFailedCalls = [];
    this.retryTimer = null;
    this.isDisposed = false;
}

/**
 * Performs a get request.
 * @see {@link saxo.openapi.TransportRetry#get}
 * @function
 */
TransportRetry.prototype.get = transportMethod('get');

/**
 * Performs a post request.
 * @see {@link saxo.openapi.TransportRetry#post}
 * @function
 */
TransportRetry.prototype.post = transportMethod('post');

/**
 * Performs a put request.
 * @see {@link saxo.openapi.TransportRetry#put}
 * @function
 */
TransportRetry.prototype.put = transportMethod('put');

/**
 * Performs a delete request.
 * @see {@link saxo.openapi.TransportRetry#delete}
 * @function
 */
TransportRetry.prototype.delete = transportMethod('delete');

/**
 * Performs a patch request.
 * @see {@link saxo.openapi.TransportRetry#patch}
 * @function
 */
TransportRetry.prototype.patch = transportMethod('patch');

/**
 * Performs a patch request.
 * @see {@link saxo.openapi.TransportRetry#head}
 * @function
 */
TransportRetry.prototype.head = transportMethod('head');

/**
 * Performs a patch request.
 * @see {@link saxo.openapi.TransportRetry#options}
 * @function
 */
TransportRetry.prototype.options = transportMethod('options');

/**
 * @protected
 * @param transportCall
 */
TransportRetry.prototype.sendTransportCall = function(transportCall) {
    this.transport[transportCall.method]
        .apply(this.transport, transportCall.args)
        .then(transportCall.resolve,
            (response) => {
                const callOptions = this.methods[transportCall.method];
                const isRetryRequest = !(response && response.status) || callOptions.statuses && callOptions.statuses.indexOf(response.status) >= 0;
                const isWithinRetryLimitOption = callOptions.retryLimit > 0 && transportCall.retryCount < callOptions.retryLimit;
                const isWithinRetryTimeoutsOption = callOptions.retryTimeouts && transportCall.retryCount < callOptions.retryTimeouts.length;
                if (isRetryRequest && (isWithinRetryLimitOption || isWithinRetryTimeoutsOption) && !this.isDisposed) {
                    this.addFailedCall(transportCall);
                } else {
                    transportCall.reject.apply(null, arguments);
                }
            });
};

/**
 * @protected
 * @param transportCall
 */
TransportRetry.prototype.addFailedCall = function(transportCall) {
    const callOptions = this.methods[transportCall.method];
    if (callOptions.retryTimeouts && callOptions.retryTimeouts.length > transportCall.retryCount) {
        // schedule an individual retry timeout
        this.individualFailedCalls.push(transportCall);
        transportCall.retryTimer = setTimeout(() => {
            this.retryIndividualFailedCall(transportCall);
        }, callOptions.retryTimeouts[transportCall.retryCount]);
    } else {
        this.failedCalls.push(transportCall);
        if (!this.retryTimer) {
            // schedule a retry timeout for all failed calls
            this.retryTimer = setTimeout(() => {
                this.retryFailedCalls();
            }, this.retryTimeout);
        }
    }
    transportCall.retryCount++;
};

/**
 * @protected
 */
TransportRetry.prototype.retryFailedCalls = function() {
    this.retryTimer = null;
    while (this.failedCalls.length > 0) {
        this.sendTransportCall(this.failedCalls.shift());
    }
};

/**
 * @protected
 * @param transportCall
 */
TransportRetry.prototype.retryIndividualFailedCall = function(transportCall) {
    transportCall.retryTimer = null;
    const individualFailedCallsIndex = this.individualFailedCalls.indexOf(transportCall);
    if (individualFailedCallsIndex >= 0) {
        this.individualFailedCalls.splice(individualFailedCallsIndex, 1);
    }
    this.sendTransportCall(transportCall);
};

/**
 * Disposes the underlying transport, the failed calls queue and clears retry timers.
 */
TransportRetry.prototype.dispose = function() {
    this.isDisposed = true;
    this.individualFailedCalls.forEach((failedCall) => {
        if (failedCall.retryTimer != null) {
            clearTimeout(failedCall.retryTimer);
            failedCall.retryTimer = null;
        }
    });
    if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }
    this.individualFailedCalls.concat(this.failedCalls).forEach((transportCall) => {
        transportCall.reject.apply(null);
    });
    this.individualFailedCalls.length = 0;
    this.failedCalls.length = 0;
    this.transport.dispose();
};

// -- Export section --
export default TransportRetry;
