/**
 * @module saxo/openapi/streaming/streaming
 * @ignore
 */

import emitter from '../../micro-emitter';
import { extend } from '../../utils/object';
import log from '../../log';
import { padLeft } from '../../utils/string';
import Subscription from './subscription';
import ParserFacade from './parser/parser-facade';
import StreamingOrphanFinder from './orphan-finder';
import Connection from './connection/connection';
import * as connectionConstants from './connection/constants';
import * as streamingTransports from './connection/transportTypes';

// -- Local variables section --

const OPENAPI_CONTROL_MESSAGE_PREFIX = '_';
const OPENAPI_CONTROL_MESSAGE_HEARTBEAT = '_heartbeat';
const OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS = '_resetsubscriptions';
const OPENAPI_CONTROL_MESSAGE_RECONNECT = '_reconnect';
const OPENAPI_CONTROL_MESSAGE_DISCONNECT = '_disconnect';

const DEFAULT_CONNECT_RETRY_DELAY = 1000;

const LOG_AREA = 'Streaming';

const DEFAULT_STREAMING_OPTIONS = {
    waitForPageLoad: false,
    transportTypes: [
        streamingTransports.LEGACY_SIGNALR_WEBSOCKETS,
        streamingTransports.LEGACY_SIGNALR_LONG_POLLING,
    ],
    connectRetryDelay: DEFAULT_CONNECT_RETRY_DELAY,
};

// -- Local methods section --

/**
 * Initializes a connection, and starts handling streaming events.
 *
 * Starts in an Initialising state, transitions to Started when the Connection starts
 * then follows the Connection state model.
 */
function init() {
    // cleanup old connection if any
    if (this.connection) {
        this.connection.dispose();
    }

    this.connection = new Connection(
        this.options,
        this.baseUrl,
        onStreamingFailed.bind(this),
    );

    this.connection.setStateChangedCallback(
        onConnectionStateChanged.bind(this),
    );
    this.connection.setUnauthorizedCallback(onUnauthorized.bind(this));
    this.connection.setReceivedCallback(onReceived.bind(this));
    this.connection.setConnectionSlowCallback(onConnectionSlow.bind(this));

    // start the connection process
    connect.call(this);
}

function onStreamingFailed() {
    // Allow consumer to reset streaming and reconnect with different streaming service
    this.connectionState = this.CONNECTION_STATE_DISCONNECTED;

    // Let consumer setup event handlers in case of steaming failure during initial setup
    setTimeout(() => {
        this.trigger(this.EVENT_STREAMING_FAILED);
    });
}

/**
 * The streaming connection received a unauthorized - the token is
 * being rejected so we should get a new one.
 */
function onUnauthorized() {
    this.authProvider.tokenRejected();
}

/**
 * Reconnects the streaming socket when it is disconnected
 */
function connect(isReconnection) {
    if (
        this.connectionState !== this.CONNECTION_STATE_DISCONNECTED &&
        this.connectionState !== this.CONNECTION_STATE_INITIALIZING
    ) {
        log.warn(
            LOG_AREA,
            'Only call connect on a disconnected streaming connection',
            new Error(),
        );
        return;
    }

    const startConnection = () => {
        setNewContextId.call(this);
        updateConnectionQuery.call(this);

        this.connection.start(onConnectionStarted.bind(this));
    };

    const expiry = this.authProvider.getExpiry();
    if (expiry < Date.now()) {
        // in case the refresh timer has disappeared, ensure authProvider is
        // fetching a new token
        const transport = this.getActiveTransportName();
        this.authProvider.refreshOpenApiToken();
        this.authProvider.one(this.authProvider.EVENT_TOKEN_RECEIVED, () => {
            if (isReconnection && !this.reconnecting) {
                log.debug(
                    LOG_AREA,
                    'ResetStreaming called while waiting for token during reconnection',
                    {
                        transport,
                    },
                );
                return;
            }

            startConnection();
        });
    } else {
        startConnection();
    }
}

function setNewContextId() {
    // context id must be 10 characters or less.
    // using the recommended technique for generating a context id
    // from https://wiki/display/OpenAPI/Open+API+Streaming

    const now = new Date();
    const midnight = new Date(now.toDateString());
    const msSinceMidnight = now - midnight;
    const randomNumber = Math.floor(Math.random() * 100);

    const contextId =
        padLeft(String(msSinceMidnight), 8, '0') +
        padLeft(String(randomNumber), 2, '0');
    this.contextId = contextId;
    for (let i = 0; i < this.subscriptions.length; i++) {
        this.subscriptions[i].streamingContextId = contextId;
    }
}

/**
 * Find matching delay based on current retry count/index.
 * @param retryLevels - The retry levels that contain different delays for various retry count levels.
 *                      Structure: [ { level: Number, delay: Number } ].
 * @param retryIndex - The current retry index/try/count.
 * @param defaultDelay {number} - The default delay.
 * @returns {number} Matching delay to retry index/try/count.
 */
export function findRetryDelay(retryLevels, retryIndex, defaultDelay) {
    let lastFoundDelay = defaultDelay;

    for (let i = 0; i < retryLevels.length; i++) {
        const levelData = retryLevels[i];
        if (retryIndex >= levelData.level) {
            lastFoundDelay = levelData.delay;
        }
    }

    return lastFoundDelay;
}

/**
 * Retries the connection after a time
 */
function retryConnection() {
    let delay = this.retryDelay;

    if (this.retryDelayLevels) {
        delay = findRetryDelay(
            this.retryDelayLevels,
            this.retryCount,
            this.retryDelay,
        );
    }

    this.retryCount++;
    this.reconnecting = true;
    this.reconnectTimer = setTimeout(connect.bind(this, true), delay);
}

/**
 * Handles connection state change
 */
function onConnectionStateChanged(nextState) {
    const connectionTransport = this.getActiveTransportName();

    if (nextState === this.connectionState) {
        log.warn(LOG_AREA, 'Tring to set same state as current one', {
            connectionState: this.READABLE_CONNECTION_STATE_MAP[
                this.connectionState
            ],
            mechanism: connectionTransport,
            reconnecting: this.reconnecting,
        });
        return;
    }

    this.connectionState = nextState;

    log.info(
        LOG_AREA,
        'Connection state changed',
        {
            changedTo: this.READABLE_CONNECTION_STATE_MAP[this.connectionState],
            mechanism: connectionTransport,
            reconnecting: this.reconnecting,
        },
        { persist: connectionTransport === streamingTransports.SIGNALR_CORE },
    );

    this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);

    if (this.disposed || this.paused) {
        return;
    }

    switch (this.connectionState) {
        case this.CONNECTION_STATE_DISCONNECTED:
            this.orphanFinder.stop();

            if (this.isReset) {
                init.call(this);
            } else {
                // tell all subscriptions not to do anything
                // as we may have lost internet and the subscriptions may not be reset
                for (let i = 0; i < this.subscriptions.length; i++) {
                    this.subscriptions[i].onConnectionUnavailable();
                }

                retryConnection.call(this);
            }

            break;

        case this.CONNECTION_STATE_RECONNECTING:
            // tell all subscriptions not to do anything
            // as we may have lost internet and the subscriptions may not be reset
            for (let i = 0; i < this.subscriptions.length; i++) {
                this.subscriptions[i].onConnectionUnavailable();
            }

            updateConnectionQuery.call(this);

            this.orphanFinder.stop();
            break;

        case this.CONNECTION_STATE_CONNECTED:
            this.retryCount = 0;
            // if *we* are reconnecting (as opposed to transport reconnecting, which we do not need to handle specially)
            if (this.reconnecting || this.isReset) {
                resetSubscriptions.call(this, this.subscriptions);
                this.reconnecting = false;
                this.isReset = false;
            }

            for (let i = 0; i < this.subscriptions.length; i++) {
                this.subscriptions[i].onConnectionAvailable();
            }

            this.orphanFinder.start();
            break;
    }
}

/**
 * Handles connection start
 */
function onConnectionStarted() {
    // sometimes the started gets called after connected, sometimes before
    if (this.connectionState === this.CONNECTION_STATE_INITIALIZING) {
        this.connectionState = this.CONNECTION_STATE_STARTED;
    }

    log.info(LOG_AREA, 'Connection started');

    this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);
}

function processUpdate(update) {
    try {
        if (update.ReferenceId[0] === OPENAPI_CONTROL_MESSAGE_PREFIX) {
            handleControlMessage.call(this, update);
        } else {
            sendDataUpdateToSubscribers.call(this, update);
        }
    } catch (error) {
        log.error(LOG_AREA, 'Error occurred in onReceived processing update', {
            error,
            update,
        });
    }
}

/**
 * handles the connection received event from SignalR
 * @param updates
 */
function onReceived(updates) {
    if (!updates) {
        log.warn(LOG_AREA, 'onReceived called with no data', updates);
        return;
    }

    if (!Array.isArray(updates)) {
        processUpdate.call(this, updates);
        return;
    }

    for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        processUpdate.call(this, update);
    }
}

/**
 * Finds a subscription by referenceId or returns undefined if not found
 * @param {string} referenceId
 */
function findSubscriptionByReferenceId(referenceId) {
    for (let i = 0; i < this.subscriptions.length; i++) {
        if (this.subscriptions[i].referenceId === referenceId) {
            return this.subscriptions[i];
        }
    }
}

/**
 * Sends an update to a subscription by finding it and calling its callback
 * @param update
 */
function sendDataUpdateToSubscribers(update) {
    const subscription = findSubscriptionByReferenceId.call(
        this,
        update.ReferenceId,
    );
    if (!subscription || subscription.onStreamingData(update) === false) {
        // happens if we've been sent to another server and cannot kill the old subscription
        log.debug(
            LOG_AREA,
            'Data update does not match a subscription',
            update,
        );
    }
}

function getHeartbeats(message) {
    if (message.Heartbeats) {
        return message.Heartbeats;
    }

    if (message.Data && message.Data.length > 0) {
        return message.Data[0].Heartbeats;
    }

    return null;
}

function getTargetReferenceIds(message) {
    if (message.TargetReferenceIds) {
        return message.TargetReferenceIds;
    }

    if (message.Data && message.Data.length > 0) {
        return message.Data[0].TargetReferenceIds;
    }

    return null;
}

/**
 * Handles a control message on the streaming connection
 * @param {Object} message From open-api
 */
function handleControlMessage(message) {
    switch (message.ReferenceId) {
        case OPENAPI_CONTROL_MESSAGE_HEARTBEAT:
            handleControlMessageFireHeartbeats.call(
                this,
                getHeartbeats(message),
            );
            break;

        case OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS:
            handleControlMessageResetSubscriptions.call(
                this,
                getTargetReferenceIds(message),
            );
            break;

        case OPENAPI_CONTROL_MESSAGE_RECONNECT:
            handleControlMessageReconnect.call(this);
            break;

        case OPENAPI_CONTROL_MESSAGE_DISCONNECT:
            handleControlMessageDisconnect.call(this);
            break;

        default:
            log.warn(LOG_AREA, 'Unrecognised control message', {
                message,
                transport: this.getActiveTransportName(),
            });
            break;
    }
}

/**
 * Fires heartbeats to relevant subscriptions
 * @param {Array.<{OriginatingReferenceId: string, Reason: string}>} heartbeatList
 */
function handleControlMessageFireHeartbeats(heartbeatList) {
    log.debug(LOG_AREA, 'heartbeats received', heartbeatList);
    for (let i = 0; i < heartbeatList.length; i++) {
        const heartbeat = heartbeatList[i];
        const subscription = findSubscriptionByReferenceId.call(
            this,
            heartbeat.OriginatingReferenceId,
        );
        if (subscription) {
            subscription.onHeartbeat();
        } else {
            // happens if we've been sent to another server and cannot kill the old subscription
            log.debug(
                LOG_AREA,
                'Heartbeat received for non-found subscription',
                heartbeat,
            );
        }
    }
}

/**
 * Resets subscriptions passed
 */
function resetSubscriptions(subscriptions) {
    for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        subscription.reset();
    }
}

/**
 * Handles the control message to reset subscriptions based on a id list. If no list is given,
 * reset all subscriptions.
 * @param {Array.<string>} referenceIdList
 */
function handleControlMessageResetSubscriptions(referenceIdList) {
    if (!referenceIdList || !referenceIdList.length) {
        log.debug(LOG_AREA, 'Resetting all subscriptions');
        resetSubscriptions.call(this, this.subscriptions.slice(0));
        return;
    }

    log.debug(LOG_AREA, 'Resetting subscriptions', referenceIdList);

    const subscriptionsToReset = [];
    for (let i = 0; i < referenceIdList.length; i++) {
        const referenceId = referenceIdList[i];
        const subscription = findSubscriptionByReferenceId.call(
            this,
            referenceId,
        );
        if (subscription) {
            subscriptionsToReset.push(subscription);
        } else {
            log.debug(
                LOG_AREA,
                "Couldn't find subscription to reset",
                referenceId,
            );
        }
    }
    resetSubscriptions(subscriptionsToReset);
}

/**
 * Handles the control message to disconnect,
 * Notify subscriptions about connect unavailability
 * Fire disconnect requested event
 * @param {Array.<string>} referenceIdList
 */
function handleControlMessageDisconnect() {
    log.info(
        LOG_AREA,
        'disconnect control message received',
        {
            transport: this.getActiveTransportName(),
        },
        {
            persist: true,
        },
    );

    // tell all subscriptions not to do anything
    for (let i = 0; i < this.subscriptions.length; i++) {
        this.subscriptions[i].onConnectionUnavailable();
    }

    this.trigger(this.EVENT_DISCONNECT_REQUESTED);
}

function handleControlMessageReconnect() {
    log.info(
        LOG_AREA,
        'reconnect control message received',
        {
            transport: this.getActiveTransportName(),
        },
        {
            persist: true,
        },
    );

    this.isReset = true;

    // tell all subscriptions not to do anything
    for (let i = 0; i < this.subscriptions.length; i++) {
        this.subscriptions[i].onConnectionUnavailable();
    }

    this.disconnect();
}

/**
 * handles the connection slow event from SignalR. Happens when a keep-alive is missed.
 */
function onConnectionSlow() {
    log.info(LOG_AREA, 'Connection is slow');
    this.trigger(this.EVENT_CONNECTION_SLOW);
}

/**
 * Updates the connection query string
 */
function updateConnectionQuery(forceAuth = false) {
    this.connection.updateQuery(
        this.authProvider.getToken(),
        this.contextId,
        this.authProvider.getExpiry(),
        forceAuth,
    );
}

/**
 * Called when a subscription is created
 * updates the orphan finder to look for that subscription
 */
function onSubscriptionCreated() {
    this.orphanFinder.update();
}

/**
 * Called when an orphan is found - resets that subscription
 * @param subscription
 */
function onOrphanFound(subscription) {
    log.info(
        LOG_AREA,
        'Subscription has become orphaned - resetting',
        subscription,
    );
    this.connection.onOrphanFound();
    subscription.reset();
}

function handleSubscriptionReadyForUnsubscribe(subscriptions, resolve) {
    let allSubscriptionsReady = true;
    for (let i = 0; i < subscriptions.length && allSubscriptionsReady; i++) {
        if (!subscriptions[i].isReadyForUnsubscribeByTag()) {
            allSubscriptionsReady = false;
        }
    }

    if (allSubscriptionsReady) {
        resolve();
    }
}

function getSubscriptionsByTag(servicePath, url, tag) {
    const subscriptionsToRemove = [];

    for (let i = 0; i < this.subscriptions.length; i++) {
        const subscription = this.subscriptions[i];

        if (
            subscription.servicePath === servicePath &&
            subscription.url === url &&
            subscription.subscriptionData.Tag === tag
        ) {
            subscriptionsToRemove.push(subscription);
        }
    }

    return subscriptionsToRemove;
}

function getSubscriptionsReadyPromise(
    subscriptionsToRemove,
    shouldDisposeSubscription,
) {
    let onStateChanged;

    return new Promise((resolve) => {
        onStateChanged = handleSubscriptionReadyForUnsubscribe.bind(
            this,
            subscriptionsToRemove,
            resolve,
        );

        for (let i = 0; i < subscriptionsToRemove.length; i++) {
            const subscription = subscriptionsToRemove[i];

            subscription.addStateChangedCallback(onStateChanged);

            subscription.onUnsubscribeByTagPending();

            if (shouldDisposeSubscription) {
                removeSubscription.call(this, subscription);
            }
        }
    }).then(() => {
        for (let i = 0; i < subscriptionsToRemove.length; i++) {
            const subscription = subscriptionsToRemove[i];
            subscription.removeStateChangedCallback(onStateChanged);
        }
    });
}

function unsubscribeSubscriptionByTag(
    servicePath,
    url,
    tag,
    shouldDisposeSubscription,
) {
    const subscriptionsToRemove = getSubscriptionsByTag.call(
        this,
        servicePath,
        url,
        tag,
    );

    const allSubscriptionsReady = getSubscriptionsReadyPromise.call(
        this,
        subscriptionsToRemove,
        shouldDisposeSubscription,
    );

    allSubscriptionsReady.then(() => {
        this.transport
            .delete(servicePath, url + '/{contextId}/?Tag={tag}', {
                contextId: this.contextId,
                tag,
            })
            .catch((response) =>
                log.error(LOG_AREA, 'An error occurred unsubscribing by tag', {
                    response,
                    servicePath,
                    url,
                    tag,
                }),
            )
            .then(() => {
                for (let i = 0; i < subscriptionsToRemove.length; i++) {
                    const subscription = subscriptionsToRemove[i];
                    subscription.onUnsubscribeByTagComplete();
                }
            });
    });
}

function removeSubscription(subscription) {
    subscription.dispose();
    const indexOfSubscription = this.subscriptions.indexOf(subscription);
    if (indexOfSubscription >= 0) {
        this.subscriptions.splice(indexOfSubscription, 1);
    }
}

function onSubscribeNetworkError() {
    this.connection.onSubscribeNetworkError();
}

// -- Exported methods section --

/**
 * Manages subscriptions to the Open API streaming service.
 * Once created this will immediately attempt to start the streaming service
 *
 * @class
 * @alias saxo.openapi.Streaming
 * @mixes MicroEmitter
 * @param {Transport} transport - The transport to use for subscribing/unsubscribing.
 * @param {string} baseUrl - The base URL with which to connect. /streaming/connection will be appended to it.
 * @param {Object} authProvider - An instance of the AuthProvider class.
 * @param {Object} [options] - The configuration options for the streaming connection
 * @param {number} [options.connectRetryDelay=1000] - The delay in milliseconds to wait before attempting a new connect after
 *          signal-r has disconnected
 * @param {Object} [options.connectRetryDelayLevels] - The levels of delays in milliseconds for specific retry counts.
 *          Structure: [{ level:Number, delay:Number }].
 * @param {Boolean} [options.waitForPageLoad=true] - Whether the signal-r streaming connection waits for page load before starting
 * @param {Object} [options.parsers={}] - The map of subscription parsers where key is format name and value is parser constructor.
 * @param {Object} [options.parserEngines={}] - The map of subscription parser engines where key is format name and
 *          value is an engine implementation.
 * @param {Array.<string>} [options.transportTypes=['plainWebSockets', 'webSockets', 'longPolling']] - The transports to be used in order by signal-r.
 * @param {Object} [options.messageProtocol={}] - Message serialization protocol used by signalr core
 */
function Streaming(transport, baseUrl, authProvider, options) {
    emitter.mixinTo(this);

    this.retryCount = 0;
    this.connectionState = this.CONNECTION_STATE_INITIALIZING;
    this.baseUrl = baseUrl;
    this.authProvider = authProvider;
    this.transport = transport;
    this.subscriptions = [];
    this.isReset = false;
    this.paused = false;

    this.setOptions({ ...DEFAULT_STREAMING_OPTIONS, ...options });

    this.authProvider.on(this.authProvider.EVENT_TOKEN_RECEIVED, () => {
        // Forcing authorization request upon new token arrival.
        const forceAuthorizationRequest = true;
        updateConnectionQuery.call(this, forceAuthorizationRequest);
    });

    this.orphanFinder = new StreamingOrphanFinder(
        this.subscriptions,
        onOrphanFound.bind(this),
    );

    init.call(this);
}

/**
 * Event that occurs when the connection state changes.
 */
Streaming.prototype.EVENT_CONNECTION_STATE_CHANGED =
    connectionConstants.EVENT_CONNECTION_STATE_CHANGED;
/**
 * Event that occurs when the connection is slow.
 */
Streaming.prototype.EVENT_CONNECTION_SLOW =
    connectionConstants.EVENT_CONNECTION_SLOW;

/**
 * Event that occurs when the connection has completely failed.
 */
Streaming.prototype.EVENT_STREAMING_FAILED =
    connectionConstants.EVENT_STREAMING_FAILED;

/**
 * Event that occurs when server sends _disconnect control message.
 */
Streaming.prototype.EVENT_DISCONNECT_REQUESTED =
    connectionConstants.EVENT_DISCONNECT_REQUESTED;

/**
 * Streaming has been created but has not yet started the connection.
 */
Streaming.prototype.CONNECTION_STATE_INITIALIZING =
    connectionConstants.CONNECTION_STATE_INITIALIZING;
/**
 * The connection has been started but may not yet be connecting.
 */
Streaming.prototype.CONNECTION_STATE_STARTED =
    connectionConstants.CONNECTION_STATE_STARTED;
/**
 * Connection is trying to connect. The previous state was CONNECTION_STATE_STARTED or CONNECTION_STATE_DISCONNECTED.
 */
Streaming.prototype.CONNECTION_STATE_CONNECTING =
    connectionConstants.CONNECTION_STATE_CONNECTING;
/**
 * Connection is connected and everything is good.
 */
Streaming.prototype.CONNECTION_STATE_CONNECTED =
    connectionConstants.CONNECTION_STATE_CONNECTED;
/**
 * Connection is reconnecting. The previous state was CONNECTION_STATE_CONNECTING.
 * We are current not connected, but might recover without having to reset.
 */
Streaming.prototype.CONNECTION_STATE_RECONNECTING =
    connectionConstants.CONNECTION_STATE_RECONNECTING;
/**
 * Connection is disconnected. Streaming may attempt to connect again.
 */
Streaming.prototype.CONNECTION_STATE_DISCONNECTED =
    connectionConstants.CONNECTION_STATE_DISCONNECTED;

Streaming.prototype.READABLE_CONNECTION_STATE_MAP =
    connectionConstants.READABLE_CONNECTION_STATE_MAP;

/**
 * Constructs a new subscription to the given resource.
 *
 * @param {string} servicePath - The service path e.g. 'trade'
 * @param {string} url - The name of the resource to subscribe to, e.g. '/v1/infoprices/subscriptions'.
 * @param {object} subscriptionArgs - Arguments that detail the subscription.
 * @param {number} [subscriptionArgs.RefreshRate=1000] - The data refresh rate (passed to OpenAPI).
 * @param {string} [subscriptionArgs.Format] - The format for the subscription (passed to OpenAPI).
 * @param {object} [subscriptionArgs.Arguments] - The subscription arguments (passed to OpenAPI).
 * @param {string} [subscriptionArgs.Tag] - The tag for the subscription (passed to OpenAPI).
 * @param {objecy} options - Optional parameters
 * @param {object} [options.headers] - headers to add to the subscription request
 * @param {function} [options.onUpdate] - A callback function that is invoked when an initial snapshot or update is received.
 *                              The first argument will be the data received and the second argument will either be
 *                              subscription.UPDATE_TYPE_DELTA or subscription.UPDATE_TYPE_SNAPSHOT
 * @param {function} [options.onError] - A callback function that is invoked when an error occurs.
 * @param {function} [options.onQueueEmpty] - A callback function that is invoked after the last action is dequeued.
 * @returns {saxo.openapi.StreamingSubscription} A subscription object.
 */
Streaming.prototype.createSubscription = function (
    servicePath,
    url,
    subscriptionArgs,
    options,
) {
    const normalizedSubscriptionArgs = extend({}, subscriptionArgs);

    if (!ParserFacade.isFormatSupported(normalizedSubscriptionArgs.Format)) {
        // Set default format, if target format is not supported.
        normalizedSubscriptionArgs.Format = ParserFacade.getDefaultFormat();
    }

    options = extend(
        {
            onNetworkError: onSubscribeNetworkError.bind(this),
        },
        options,
    );

    const subscription = new Subscription(
        this.contextId,
        this.transport,
        servicePath,
        url,
        normalizedSubscriptionArgs,
        onSubscriptionCreated.bind(this),
        options,
    );

    this.subscriptions.push(subscription);

    // set the subscription to connection unavailable, the subscription will then subscribe when the connection becomes available.
    if (this.connectionState !== this.CONNECTION_STATE_CONNECTED) {
        subscription.onConnectionUnavailable();
    }
    subscription.onSubscribe();

    return subscription;
};

/**
 * Makes a subscription start.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to start.
 */
Streaming.prototype.subscribe = function (subscription) {
    subscription.onSubscribe();
};

/**
 * Makes a subscription start with modification.
 * Modify subscription will keep pending unsubscribe followed by modify subscribe.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to modify.
 * @param {Object} args - The target arguments of modified subscription.
 * @param {Object} options - Options for subscription modification.
 */
Streaming.prototype.modify = function (subscription, args, options) {
    subscription.onModify(args, options);
};

/**
 * Makes a subscription stop (can be restarted). See {@link saxo.openapi.Streaming#disposeSubscription} for permanently stopping a subscription.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to stop.
 */
Streaming.prototype.unsubscribe = function (subscription) {
    subscription.onUnsubscribe();
};

/**
 * Disposes a subscription permanently. It will be stopped and not be able to be started.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to stop and remove.
 */
Streaming.prototype.disposeSubscription = function (subscription) {
    this.unsubscribe(subscription);
    removeSubscription.call(this, subscription);
};

/**
 * Makes all subscriptions stop at the given service path and url with the given tag (can be restarted)
 * See {@link saxo.openapi.Streaming#disposeSubscriptionByTag} for permanently stopping subscriptions by tag.
 *
 * @param {string} servicePath - the service path of the subscriptions to unsubscribe
 * @param {string} url - the url of the subscriptions to unsubscribe
 * @param {string} tag - the tag of the subscriptions to unsubscribe
 */
Streaming.prototype.unsubscribeByTag = function (servicePath, url, tag) {
    unsubscribeSubscriptionByTag.call(this, servicePath, url, tag, false);
};

/**
 * Disposes all subscriptions at the given service path and url by tag permanently. They will be stopped and not be able to be started.
 *
 * @param {string} servicePath - the service path of the subscriptions to unsubscribe
 * @param {string} url - the url of the subscriptions to unsubscribe
 * @param {string} tag - the tag of the subscriptions to unsubscribe
 */
Streaming.prototype.disposeSubscriptionByTag = function (
    servicePath,
    url,
    tag,
) {
    unsubscribeSubscriptionByTag.call(this, servicePath, url, tag, true);
};

/**
 * This disconnects the current socket. We will follow normal reconnection logic to try and restore the connection.
 * It *will not* stop the subscription (see dispose for that). It is useful for testing reconnect logic works or for resetting all subscriptions.
 */
Streaming.prototype.disconnect = function () {
    this.connection.stop();
};

Streaming.prototype.pause = function () {
    this.paused = true;

    if (this.reconnecting) {
        clearTimeout(this.reconnectTimer);
        this.reconnecting = false;
        this.retryCount = 0;
    }

    this.orphanFinder.stop();

    for (let i = 0; i < this.subscriptions.length; i++) {
        const subscription = this.subscriptions[i];
        // Reset the subscription and mark it as not having a connection so its state becomes unsubscribed
        // next action if there is any i.e. subscribe will go in the queue until the connection is available again
        subscription.reset();
        subscription.onConnectionUnavailable();
    }

    this.disconnect();
};

Streaming.prototype.resume = function () {
    if (!this.paused) {
        return;
    }

    this.paused = false;
    connect.call(this);
};

/**
 * Shuts down streaming.
 */
Streaming.prototype.dispose = function () {
    this.disposed = true;

    this.orphanFinder.stop();

    for (let i = 0; i < this.subscriptions.length; i++) {
        const subscription = this.subscriptions[i];
        // disconnecting *should* shut down all subscriptions. We also delete all below.
        // So mark the subscription as not having a connection and reset it so its state becomes unsubscribed
        subscription.onConnectionUnavailable();
        subscription.reset();
    }
    this.subscriptions.length = 0;

    // delete all subscriptions on this context id
    this.transport.delete('root', 'v1/subscriptions/{contextId}', {
        contextId: this.contextId,
    });

    this.disconnect();
};

Streaming.prototype.getQuery = function () {
    if (this.connection) {
        return this.connection.getQuery();
    }
};

Streaming.prototype.setOptions = function (options) {
    options = options || {};

    const {
        waitForPageLoad,
        transportTypes,
        transport,
        messageSerializationProtocol,
        connectRetryDelay,
        connectRetryDelayLevels,
        parserEngines,
        parsers,
    } = options;

    this.options = {
        // Faster and does not cause problems after IE8
        waitForPageLoad,
        transport: transportTypes || transport,
        // Message serialization protocol used by signalr core. Its different from protobuf used for each subscription endpoint
        // Streaming service relays message payload received from publishers as it is, which could be protobuf encoded.
        // This protocol is used to serialize the message envelope rather than the payload
        messageSerializationProtocol,
    };

    if (typeof connectRetryDelay === 'number') {
        this.retryDelay = connectRetryDelay;
    } else {
        this.retryDelay = DEFAULT_STREAMING_OPTIONS.connectRetryDelay;
    }

    if (typeof connectRetryDelayLevels === 'object') {
        this.retryDelayLevels = connectRetryDelayLevels;
    }

    if (parserEngines) {
        ParserFacade.addEngines(parserEngines);
    }

    if (parsers) {
        ParserFacade.addParsers(parsers);
    }
};

Streaming.prototype.resetStreaming = function (baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.setOptions({ ...this.options, ...options });

    this.isReset = true;

    this.orphanFinder.stop();

    if (this.reconnecting) {
        clearTimeout(this.reconnectTimer);
        this.reconnecting = false;
        this.retryCount = 0;
    }

    const activeTransport = this.connection.getTransport();
    if (
        !activeTransport ||
        this.connectionState === this.CONNECTION_STATE_DISCONNECTED
    ) {
        init.call(this);
        return;
    }

    // tell all subscriptions not to do anything
    for (let i = 0; i < this.subscriptions.length; i++) {
        this.subscriptions[i].onConnectionUnavailable();
    }

    this.disconnect();
};

Streaming.prototype.getActiveTransportName = function () {
    const activeTransport = this.connection.getTransport();

    return activeTransport && activeTransport.name;
};

Streaming.prototype.isPaused = function () {
    return this.paused;
};

// -- Export section --

export default Streaming;
