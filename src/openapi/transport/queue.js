/**
 * @module saxo/openapi/transport/queue
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

function transportMethod(method) {
    return function() {

        if (!this.isQueueing) {

            // checking expiry every time so that if device goes to sleep and is woken then
            // we intercept a call about to be made and then do not have to cope with the 401 responses
            if (this.authProvider && this.authProvider.getExpiry() < Date.now()) {
                this.isQueueing = true;
                this.authProvider.refreshOpenApiToken();
            }
        }

        const transportCallArguments = arguments;

        return new Promise((resolve, reject) => {
            const queueItem = {
                method,
                args: transportCallArguments,
                serviceGroup: transportCallArguments[0],
                urlTemplate: transportCallArguments[1],
                urlArgs: transportCallArguments[2],
                options: transportCallArguments[3],
                resolve,
                reject,
            };

            if (this.isQueueing) {
                this.addToQueue(queueItem);
            } else {
                this.runQueueItem(queueItem);
            }
        });
    };
}

function tryEmptyQueue() {
    if (this.waitForPromises.length === 0 && (!this.authProvider || this.authProvider.getExpiry() > Date.now())) {
        this.isQueueing = false;
        this.emptyQueue();
    }
}

function onWaitForPromiseResolved(promise) {
    this.waitForPromises.splice(this.waitForPromises.indexOf(promise), 1);
    tryEmptyQueue.call(this);
}

function authTokenReceived() {
    tryEmptyQueue.call(this);
}

// -- Exported methods section --

/**
 * TransportQueue wraps a transport class to allow the queueing of transport calls, so that all calls can be paused until after a particular event.
 * 1. This coordinates with authentication so that calls are queued whilst not authenticated
 * 2. The ability to wait for a promise to complete see {@link saxo.openapi.TransportQueue#waitFor}.
 *    The old library had an option initLoadBalancerCookies which did
 *    two calls to isalive before allowing any other calls through. This can be implemented with this class.
 * 3. It serves as a base class for auto batching, which by its nature queues calls.
 * @class
 * @alias saxo.openapi.TransportQueue
 * @param {saxo.openapi.TransportAuth|saxo.openapi.TransportBatch|saxo.openapi.TransportCore|saxo.openapi.TransportQueue} transport -
 *      The transport to wrap.
 * @param {saxo.openapi.authProvider} [authProvider] - If provided then calls will be queued whilst the token is expired.
 *      If not given then calls will continue even when the authentication is not expired and no 401 calls will be handled.
 */
function TransportQueue(transport, authProvider) {

    if (!transport) {
        throw new Error('Missing required parameter: transport in TransportQueue');
    }

    this.isQueueing = false;
    if (authProvider) {
        this.authProvider = authProvider;
        if (authProvider.getExpiry() < Date.now()) {
            this.isQueueing = true;
        }
        // subscribe to listen for authentication changes that might trigger auth to be valid and the queue to empty
        authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, authTokenReceived, this);
    }

    this.queue = [];
    this.transport = transport;
    this.waitForPromises = [];
}

/**
 * Performs a queued get request.
 * @see {@link saxo.openapi.TransportCore#get}
 * @function
 */
TransportQueue.prototype.get = transportMethod('get');

/**
 * Performs a queued post request.
 * @see {@link saxo.openapi.TransportCore#post}
 * @function
 */
TransportQueue.prototype.post = transportMethod('post');

/**
 * Performs a queued put request.
 * @see {@link saxo.openapi.TransportCore#put}
 * @function
 */
TransportQueue.prototype.put = transportMethod('put');

/**
 * Performs a queued delete request.
 * @see {@link saxo.openapi.TransportCore#delete}
 * @function
 */
TransportQueue.prototype.delete = transportMethod('delete');

/**
 * Performs a queued patch request.
 * @see {@link saxo.openapi.TransportCore#patch}
 * @function
 */
TransportQueue.prototype.patch = transportMethod('patch');

/**
 * Performs a queued head request.
 * @see {@link saxo.openapi.TransportCore#head}
 * @function
 */
TransportQueue.prototype.head = transportMethod('head');

/**
 * Performs a queued options request.
 * @see {@link saxo.openapi.TransportCore#options}
 * @function
 */
TransportQueue.prototype.options = transportMethod('options');

/**
 * Waits for a promise to finish before allowing the queue to continue.
 * @param promise
 */
TransportQueue.prototype.waitFor = function(promise) {
    this.waitForPromises.push(promise);
    this.isQueueing = true;
    promise.then(onWaitForPromiseResolved.bind(this, promise));
};

/**
 * @protected
 */
TransportQueue.prototype.emptyQueue = function() {
    for (let i = 0; i < this.queue.length; i++) {
        this.runQueueItem(this.queue[i]);
    }
    this.queue.length = 0;
};

/**
 * @protected
 * @param item
 */
TransportQueue.prototype.runQueueItem = function(item) {
    this.transport[item.method]
        .apply(this.transport, item.args)
        .then((...args) => {
            item.resolve(...args);
        },
        (result, ...args) => {
            if (this.authProvider && result && result.status === 401) {
                this.addToQueue(item);
                // if we are fetching a new token, wait
                if (this.authProvider.isFetchingNewToken()) {
                    this.isQueueing = true;
                } else {
                    // if not we might already have a new token, so run straight away
                    tryEmptyQueue.call(this);
                }
                return;
            }
            item.reject(result, ...args);
        });
};

/**
 * @protected
 * @param item
 */
TransportQueue.prototype.addToQueue = function(item) {
    this.queue.push(item);
};

/**
 * Disposes the transport queue and removes any pending items.
 */
TransportQueue.prototype.dispose = function() {
    this.queue.length = 0;
    if (this.authProvider) {
        this.authProvider.off(this.authProvider.EVENT_TOKEN_RECEIVED, authTokenReceived, this);
    }
    this.transport.dispose();
};

// -- Export section --

export default TransportQueue;
