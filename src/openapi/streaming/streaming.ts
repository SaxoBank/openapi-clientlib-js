import MicroEmitter from '../../micro-emitter';
import log from '../../log';
import { padLeft } from '../../utils/string';
import Subscription from './subscription';
import type { SubscriptionArgs, StreamingOptions } from './subscription';
import ParserFacade from './parser/parser-facade';
import StreamingOrphanFinder from './orphan-finder';
import Connection from './connection/connection';
import * as connectionConstants from './connection/constants';
import * as streamingTransports from './connection/transportTypes';
import type * as types from './types';
import type AuthProvider from '../authProvider';
import type { ITransport } from '../transport/transport-base';

export const OPENAPI_CONTROL_MESSAGE_PREFIX = '_';
export const OPENAPI_CONTROL_MESSAGE_HEARTBEAT = '_heartbeat';
export const OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS =
    '_resetsubscriptions';
export const OPENAPI_CONTROL_MESSAGE_RECONNECT = '_reconnect';
export const OPENAPI_CONTROL_MESSAGE_DISCONNECT = '_disconnect';

const DEFAULT_CONNECT_RETRY_DELAY = 1000;

const LOG_AREA = 'Streaming';

const DEFAULT_STREAMING_OPTIONS = {
    waitForPageLoad: false,
    transportTypes: [
        streamingTransports.LEGACY_SIGNALR_WEBSOCKETS,
        streamingTransports.LEGACY_SIGNALR_LONG_POLLING,
    ],
};

/**
 * Find matching delay based on current retry count/index.
 * @param retryLevels - The retry levels that contain different delays for various retry count levels.
 *                      Structure: `[ { level: Number, delay: Number } ].`
 * @param retryIndex - The current retry index/try/count.
 * @param defaultDelay - The default delay.
 * @returns  Matching delay to retry index/try/count.
 */
export function findRetryDelay(
    retryLevels: types.RetryDelayLevel[],
    retryIndex: number,
    defaultDelay: number,
) {
    let lastFoundDelay = defaultDelay;

    for (let i = 0; i < retryLevels.length; i++) {
        const levelData = retryLevels[i];
        if (retryIndex >= levelData.level) {
            lastFoundDelay = levelData.delay;
        }
    }

    return lastFoundDelay;
}

type EmittedEvents = {
    [connectionConstants.EVENT_CONNECTION_STATE_CHANGED]: (
        connectionState: types.ConnectionState | null,
    ) => void;
    [connectionConstants.EVENT_STREAMING_FAILED]: () => void;
    [connectionConstants.EVENT_CONNECTION_SLOW]: () => void;
    [connectionConstants.EVENT_DISCONNECT_REQUESTED]: () => void;
};

/**
 * Manages subscriptions to the Open API streaming service.
 * Once created this will immediately attempt to start the streaming service
 */
class Streaming extends MicroEmitter<EmittedEvents> {
    /**
     * Event that occurs when the connection state changes.
     */
    EVENT_CONNECTION_STATE_CHANGED =
        connectionConstants.EVENT_CONNECTION_STATE_CHANGED;
    /**
     * Event that occurs when the connection is slow.
     */
    EVENT_CONNECTION_SLOW = connectionConstants.EVENT_CONNECTION_SLOW;

    /**
     * Event that occurs when the connection has completely failed.
     */
    EVENT_STREAMING_FAILED = connectionConstants.EVENT_STREAMING_FAILED;

    /**
     * Event that occurs when server sends _disconnect control message.
     */
    EVENT_DISCONNECT_REQUESTED = connectionConstants.EVENT_DISCONNECT_REQUESTED;

    /**
     * Streaming has been created but has not yet started the connection.
     */
    CONNECTION_STATE_INITIALIZING =
        connectionConstants.CONNECTION_STATE_INITIALIZING;
    /**
     * The connection has been started but may not yet be connecting.
     */
    CONNECTION_STATE_STARTED = connectionConstants.CONNECTION_STATE_STARTED;
    /**
     * Connection is trying to connect. The previous state was CONNECTION_STATE_STARTED or CONNECTION_STATE_DISCONNECTED.
     */
    CONNECTION_STATE_CONNECTING =
        connectionConstants.CONNECTION_STATE_CONNECTING;
    /**
     * Connection is connected and everything is good.
     */
    CONNECTION_STATE_CONNECTED = connectionConstants.CONNECTION_STATE_CONNECTED;
    /**
     * Connection is reconnecting. The previous state was CONNECTION_STATE_CONNECTING.
     * We are current not connected, but might recover without having to reset.
     */
    CONNECTION_STATE_RECONNECTING =
        connectionConstants.CONNECTION_STATE_RECONNECTING;
    /**
     * Connection is disconnected. Streaming may attempt to connect again.
     */
    CONNECTION_STATE_DISCONNECTED =
        connectionConstants.CONNECTION_STATE_DISCONNECTED;

    READABLE_CONNECTION_STATE_MAP =
        connectionConstants.READABLE_CONNECTION_STATE_MAP;

    retryCount = 0;
    connectionState: types.ConnectionState | null = this
        .CONNECTION_STATE_INITIALIZING;
    baseUrl: string;
    authProvider: AuthProvider;
    transport: ITransport;
    subscriptions: Subscription[] = [];
    isReset = false;
    paused = false;
    orphanFinder: StreamingOrphanFinder;
    connection!: Connection;
    connectionOptions: types.ConnectionOptions = {
        waitForPageLoad: false,
        transport: [
            streamingTransports.LEGACY_SIGNALR_WEBSOCKETS,
            streamingTransports.LEGACY_SIGNALR_LONG_POLLING,
        ],
    };
    reconnecting = false;
    contextId!: string;
    retryDelay = DEFAULT_CONNECT_RETRY_DELAY;
    retryDelayLevels?: types.RetryDelayLevel[];
    reconnectTimer?: number;
    disposed = false;

    /**
     * @param transport - The transport to use for subscribing/unsubscribing.
     * @param baseUrl - The base URL with which to connect. /streaming/connection will be appended to it.
     * @param authProvider - An instance of the AuthProvider class.
     * @param options - (optional) The configuration options for the streaming connection
     */
    constructor(
        transport: ITransport,
        baseUrl: string,
        authProvider: AuthProvider,
        options?: Partial<types.StreamingConfigurableOptions>,
    ) {
        super();
        this.baseUrl = baseUrl;
        this.authProvider = authProvider;
        this.transport = transport;

        this.setOptions({ ...DEFAULT_STREAMING_OPTIONS, ...options });

        this.authProvider.on(this.authProvider.EVENT_TOKEN_RECEIVED, () => {
            // Forcing authorization request upon new token arrival.
            const forceAuthorizationRequest = true;
            this.updateConnectionQuery(forceAuthorizationRequest);
        });

        this.orphanFinder = new StreamingOrphanFinder(
            this.subscriptions,
            this.onOrphanFound.bind(this),
        );

        this.init();
    }

    setOptions(options: types.StreamingConfigurableOptions) {
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

        this.connectionOptions = {
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
    }

    /**
     * Initializes a connection, and starts handling streaming events.
     *
     * Starts in an Initializing state, transitions to Started when the Connection starts
     * then follows the Connection state model.
     */
    private init() {
        // cleanup old connection if any
        if (this.connection) {
            this.connection.dispose();
        }

        this.connection = new Connection(
            this.connectionOptions,
            this.baseUrl,
            this.onStreamingFailed.bind(this),
        );

        this.connection.setStateChangedCallback(
            this.onConnectionStateChanged.bind(this),
        );
        this.connection.setUnauthorizedCallback(this.onUnauthorized.bind(this));
        this.connection.setReceivedCallback(this.onReceived.bind(this));
        this.connection.setConnectionSlowCallback(
            this.onConnectionSlow.bind(this),
        );

        // start the connection process
        this.connect();
    }

    private onStreamingFailed() {
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
    private onUnauthorized() {
        this.authProvider.tokenRejected();
    }

    /**
     * Reconnects the streaming socket when it is disconnected
     */
    private connect(isReconnection?: boolean) {
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
            this.setNewContextId();
            this.updateConnectionQuery();

            this.connection.start(this.onConnectionStarted.bind(this));
        };

        const expiry = this.authProvider.getExpiry();
        if (expiry < Date.now()) {
            // in case the refresh timer has disappeared, ensure authProvider is
            // fetching a new token
            const transport = this.getActiveTransportName();
            this.authProvider.refreshOpenApiToken();
            this.authProvider.one(
                this.authProvider.EVENT_TOKEN_RECEIVED,
                () => {
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
                },
            );
        } else {
            startConnection();
        }
    }

    private setNewContextId() {
        // context id must be 10 characters or less.
        // using the recommended technique for generating a context id
        // from https://wiki/display/OpenAPI/Open+API+Streaming

        const now = new Date();
        const midnight = new Date(now.toDateString());
        const msSinceMidnight = Number(now) - Number(midnight);
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
     * Retries the connection after a time
     */
    private retryConnection() {
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
        this.reconnectTimer = window.setTimeout(
            this.connect.bind(this, true),
            delay,
        );
    }

    /**
     * Handles connection state change
     */
    private onConnectionStateChanged(nextState: types.ConnectionState | null) {
        const connectionTransport = this.getActiveTransportName();

        if (nextState === this.connectionState) {
            log.warn(LOG_AREA, 'Trying to set same state as current one', {
                connectionState:
                    this.connectionState &&
                    this.READABLE_CONNECTION_STATE_MAP[this.connectionState],
                mechanism: connectionTransport,
                reconnecting: this.reconnecting,
            });
            return;
        }

        this.connectionState = nextState;

        log.info(LOG_AREA, 'Connection state changed', {
            changedTo:
                this.connectionState &&
                this.READABLE_CONNECTION_STATE_MAP[this.connectionState],
            mechanism: connectionTransport,
            reconnecting: this.reconnecting,
        });

        this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);

        if (this.disposed || this.paused) {
            return;
        }

        switch (this.connectionState) {
            case this.CONNECTION_STATE_DISCONNECTED:
                this.orphanFinder.stop();

                if (this.isReset) {
                    this.init();
                } else {
                    // tell all subscriptions not to do anything
                    // as we may have lost internet and the subscriptions may not be reset
                    for (let i = 0; i < this.subscriptions.length; i++) {
                        this.subscriptions[i].onConnectionUnavailable();
                    }

                    this.retryConnection();
                }

                break;

            case this.CONNECTION_STATE_RECONNECTING:
                // tell all subscriptions not to do anything
                // as we may have lost internet and the subscriptions may not be reset
                for (let i = 0; i < this.subscriptions.length; i++) {
                    this.subscriptions[i].onConnectionUnavailable();
                }

                this.updateConnectionQuery();

                this.orphanFinder.stop();
                break;

            case this.CONNECTION_STATE_CONNECTED:
                this.retryCount = 0;
                // if *we* are reconnecting (as opposed to transport reconnecting, which we do not need to handle specially)
                if (this.reconnecting || this.isReset) {
                    this.resetSubscriptions(this.subscriptions);
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
    private onConnectionStarted() {
        // sometimes the started gets called after connected, sometimes before
        if (this.connectionState === this.CONNECTION_STATE_INITIALIZING) {
            this.connectionState = this.CONNECTION_STATE_STARTED;
        }

        log.info(LOG_AREA, 'Connection started');

        this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);
    }

    private processUpdate(update: types.StreamingMessage) {
        try {
            if (update.ReferenceId[0] === OPENAPI_CONTROL_MESSAGE_PREFIX) {
                this.handleControlMessage(update as types.ControlMessage);
            } else {
                this.sendDataUpdateToSubscribers(update);
            }
        } catch (error) {
            log.error(
                LOG_AREA,
                'Error occurred in onReceived processing update',
                {
                    error,
                    update,
                },
            );
        }
    }

    /**
     * handles the connection received event from SignalR
     * @param updates - updates
     */
    private onReceived(
        updates: types.StreamingMessage | Array<types.StreamingMessage>,
    ) {
        if (!updates) {
            log.warn(LOG_AREA, 'onReceived called with no data', updates);
            return;
        }

        if (!Array.isArray(updates)) {
            this.processUpdate(updates);
            return;
        }

        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            this.processUpdate(update);
        }
    }

    /**
     * Finds a subscription by referenceId or returns undefined if not found
     * @param referenceId - referenceId
     */
    private findSubscriptionByReferenceId(referenceId: string) {
        for (let i = 0; i < this.subscriptions.length; i++) {
            if (this.subscriptions[i].referenceId === referenceId) {
                return this.subscriptions[i];
            }
        }

        return undefined;
    }

    /**
     * Sends an update to a subscription by finding it and calling its callback
     * @param update - update
     */
    private sendDataUpdateToSubscribers(update: types.StreamingMessage) {
        const subscription = this.findSubscriptionByReferenceId(
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

    private getHeartbeats(message: types.HeartbeatsControlMessage) {
        if (message.Heartbeats) {
            return message.Heartbeats;
        }

        if (message.Data && message.Data.length > 0) {
            return message.Data[0].Heartbeats;
        }

        return [];
    }

    private getTargetReferenceIds(message: types.ResetControlMessage) {
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
     * @param message - message from open-api
     */
    private handleControlMessage(message: types.ControlMessage) {
        switch (message.ReferenceId) {
            case OPENAPI_CONTROL_MESSAGE_HEARTBEAT:
                this.handleControlMessageFireHeartbeats(
                    this.getHeartbeats(message),
                );
                break;

            case OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS:
                this.handleControlMessageResetSubscriptions(
                    this.getTargetReferenceIds(message),
                );
                break;

            case OPENAPI_CONTROL_MESSAGE_RECONNECT:
                this.handleControlMessageReconnect();
                break;

            case OPENAPI_CONTROL_MESSAGE_DISCONNECT:
                this.handleControlMessageDisconnect();
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
     * @param heartbeatList - heartbeatList
     */
    private handleControlMessageFireHeartbeats(
        heartbeatList: types.Heartbeats[],
    ) {
        log.debug(LOG_AREA, 'heartbeats received', { heartbeatList });

        for (let i = 0; i < heartbeatList.length; i++) {
            const heartbeat = heartbeatList[i];
            const subscription = this.findSubscriptionByReferenceId(
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
    private resetSubscriptions(subscriptions: Subscription[]) {
        for (let i = 0; i < subscriptions.length; i++) {
            const subscription = subscriptions[i];
            subscription.reset();
        }
    }

    /**
     * Handles the control message to reset subscriptions based on a id list. If no list is given,
     * reset all subscriptions.
     * @param referenceIdList - referenceIdList
     */
    private handleControlMessageResetSubscriptions(
        referenceIdList: string[] | null,
    ) {
        if (!referenceIdList || !referenceIdList.length) {
            log.debug(LOG_AREA, 'Resetting all subscriptions');
            this.resetSubscriptions(this.subscriptions.slice(0));
            return;
        }

        log.debug(LOG_AREA, 'Resetting subscriptions', referenceIdList);

        const subscriptionsToReset = [];
        for (let i = 0; i < referenceIdList.length; i++) {
            const referenceId = referenceIdList[i];
            const subscription = this.findSubscriptionByReferenceId(
                referenceId,
            );
            if (subscription) {
                subscriptionsToReset.push(subscription);
            } else {
                log.debug(LOG_AREA, "Couldn't find subscription to reset", {
                    referenceId,
                });
            }
        }

        this.resetSubscriptions(subscriptionsToReset);
    }

    /**
     * Handles the control message to disconnect,
     * Notify subscriptions about connect unavailability
     * Fire disconnect requested event
     * @param referenceIdList - referenceIdList
     */
    private handleControlMessageDisconnect() {
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

    private handleControlMessageReconnect() {
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
    private onConnectionSlow() {
        log.info(LOG_AREA, 'Connection is slow');
        this.trigger(this.EVENT_CONNECTION_SLOW);
    }

    /**
     * Updates the connection query string
     */
    private updateConnectionQuery(forceAuth = false) {
        this.connection.updateQuery(
            this.authProvider.getToken() as string, // assuming token is received at this point
            this.contextId,
            this.authProvider.getExpiry(),
            forceAuth,
        );
    }

    /**
     * Called when a subscription is created
     * updates the orphan finder to look for that subscription
     */
    private onSubscriptionCreated() {
        this.orphanFinder.update();
    }

    /**
     * Called when an orphan is found - resets that subscription
     * @param subscription - subscription
     */
    private onOrphanFound(subscription: Subscription) {
        log.info(
            LOG_AREA,
            'Subscription has become orphaned - resetting',
            subscription,
        );
        this.connection.onOrphanFound();
        subscription.reset();
    }

    private handleSubscriptionReadyForUnsubscribe(
        subscriptions: Subscription[],
        resolve: (...args: unknown[]) => void,
    ) {
        let allSubscriptionsReady = true;
        for (
            let i = 0;
            i < subscriptions.length && allSubscriptionsReady;
            i++
        ) {
            if (!subscriptions[i].isReadyForUnsubscribeByTag()) {
                allSubscriptionsReady = false;
            }
        }

        if (allSubscriptionsReady) {
            resolve();
        }
    }

    private getSubscriptionsByTag(
        servicePath: string,
        url: string,
        tag: string,
    ) {
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

    private getSubscriptionsReadyPromise(
        subscriptionsToRemove: Subscription[],
        shouldDisposeSubscription: boolean,
    ) {
        let onStateChanged: (...args: unknown[]) => void;

        return new Promise((resolve) => {
            onStateChanged = this.handleSubscriptionReadyForUnsubscribe.bind(
                this,
                subscriptionsToRemove,
                resolve,
            );

            for (let i = 0; i < subscriptionsToRemove.length; i++) {
                const subscription = subscriptionsToRemove[i];

                subscription.addStateChangedCallback(onStateChanged);

                subscription.onUnsubscribeByTagPending();

                if (shouldDisposeSubscription) {
                    this.removeSubscription(subscription);
                }
            }
        }).then(() => {
            for (let i = 0; i < subscriptionsToRemove.length; i++) {
                const subscription = subscriptionsToRemove[i];
                subscription.removeStateChangedCallback(onStateChanged);
            }
        });
    }

    private unsubscribeSubscriptionByTag(
        servicePath: string,
        url: string,
        tag: string,
        shouldDisposeSubscription: boolean,
    ) {
        const subscriptionsToRemove = this.getSubscriptionsByTag(
            servicePath,
            url,
            tag,
        );

        const allSubscriptionsReady = this.getSubscriptionsReadyPromise(
            subscriptionsToRemove,
            shouldDisposeSubscription,
        );

        allSubscriptionsReady.then(() => {
            this.transport
                .delete(servicePath, url + '/{contextId}/?Tag={tag}', {
                    contextId: this.contextId,
                    tag,
                })
                .catch((response: unknown) =>
                    log.error(
                        LOG_AREA,
                        'An error occurred unsubscribing by tag',
                        {
                            response,
                            servicePath,
                            url,
                            tag,
                        },
                    ),
                )
                .then(() => {
                    for (let i = 0; i < subscriptionsToRemove.length; i++) {
                        const subscription = subscriptionsToRemove[i];
                        subscription.onUnsubscribeByTagComplete();
                    }
                });
        });
    }

    private removeSubscription(subscription: Subscription) {
        subscription.dispose();
        const indexOfSubscription = this.subscriptions.indexOf(subscription);
        if (indexOfSubscription >= 0) {
            this.subscriptions.splice(indexOfSubscription, 1);
        }
    }

    private onSubscribeNetworkError() {
        this.connection.onSubscribeNetworkError();
    }

    /**
     * Constructs a new subscription to the given resource.
     *
     * @param servicePath - The service path e.g. 'trade'
     * @param url - The name of the resource to subscribe to, e.g. '/v1/infoprices/subscriptions'.
     * @param subscriptionArgs - (optional) Arguments that detail the subscription.
     * @param options - (optional) streaming options
     * @returns  A subscription object.
     */
    createSubscription(
        servicePath: string,
        url: string,
        subscriptionArgs?: SubscriptionArgs,
        options?: StreamingOptions,
    ) {
        const normalizedSubscriptionArgs = { ...subscriptionArgs };

        if (
            !ParserFacade.isFormatSupported(normalizedSubscriptionArgs.Format)
        ) {
            // Set default format, if target format is not supported.
            normalizedSubscriptionArgs.Format = ParserFacade.getDefaultFormat();
        }

        options = {
            onNetworkError: this.onSubscribeNetworkError.bind(this),
            ...options,
        };

        const subscription = new Subscription(
            this.contextId, // assuming contextId exists at this stage
            this.transport,
            servicePath,
            url,
            normalizedSubscriptionArgs,
            this.onSubscriptionCreated.bind(this),
            options,
        );

        this.subscriptions.push(subscription);

        // set the subscription to connection unavailable, the subscription will then subscribe when the connection becomes available.
        if (this.connectionState !== this.CONNECTION_STATE_CONNECTED) {
            subscription.onConnectionUnavailable();
        }
        subscription.onSubscribe();

        return subscription;
    }

    /**
     * Makes a subscription start.
     *
     * @param subscription - The subscription to start.
     */
    subscribe(subscription: Subscription) {
        subscription.onSubscribe();
    }

    /**
     * Makes a subscription start with modification.
     * Modify subscription will keep pending unsubscribe followed by modify subscribe.
     *
     * @param subscription - The subscription to modify.
     * @param args - The target arguments of modified subscription.
     * @param options - Options for subscription modification.
     */
    modify(
        subscription: Subscription,
        args: Record<string, unknown>,
        options: { isPatch: boolean; patchArgsDelta: Record<string, unknown> },
    ) {
        subscription.onModify(args, options);
    }

    /**
     * Makes a subscription stop (can be restarted). See {@link saxo.openapi.Streaming#disposeSubscription} for permanently stopping a subscription.
     *
     * @param subscription - The subscription to stop.
     */
    unsubscribe(subscription: Subscription) {
        subscription.onUnsubscribe();
    }

    /**
     * Disposes a subscription permanently. It will be stopped and not be able to be started.
     *
     * @param subscription - The subscription to stop and remove.
     */
    disposeSubscription(subscription: Subscription) {
        this.unsubscribe(subscription);
        this.removeSubscription(subscription);
    }

    /**
     * Makes all subscriptions stop at the given service path and url with the given tag (can be restarted)
     * See {@link saxo.openapi.Streaming#disposeSubscriptionByTag} for permanently stopping subscriptions by tag.
     *
     * @param servicePath - the service path of the subscriptions to unsubscribe
     * @param url - the url of the subscriptions to unsubscribe
     * @param tag - the tag of the subscriptions to unsubscribe
     */
    unsubscribeByTag(servicePath: string, url: string, tag: string) {
        this.unsubscribeSubscriptionByTag(servicePath, url, tag, false);
    }

    /**
     * Disposes all subscriptions at the given service path and url by tag permanently. They will be stopped and not be able to be started.
     *
     * @param servicePath - the service path of the subscriptions to unsubscribe
     * @param url - the url of the subscriptions to unsubscribe
     * @param tag - the tag of the subscriptions to unsubscribe
     */
    disposeSubscriptionByTag(servicePath: string, url: string, tag: string) {
        this.unsubscribeSubscriptionByTag(servicePath, url, tag, true);
    }

    /**
     * This disconnects the current socket. We will follow normal reconnection logic to try and restore the connection.
     * It *will not* stop the subscription (see dispose for that). It is useful for testing reconnect logic works or for resetting all subscriptions.
     */
    disconnect() {
        this.connection.stop();
    }

    pause() {
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
    }

    resume() {
        if (!this.paused) {
            return;
        }

        this.paused = false;
        this.connect();
    }

    /**
     * Shuts down streaming.
     */
    dispose() {
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
    }

    getQuery() {
        if (this.connection) {
            return this.connection.getQuery();
        }
    }

    resetStreaming(baseUrl: string, options = {}) {
        this.baseUrl = baseUrl;
        this.setOptions({ ...this.connectionOptions, ...options });

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
            this.init();
            return;
        }

        // tell all subscriptions not to do anything
        for (let i = 0; i < this.subscriptions.length; i++) {
            this.subscriptions[i].onConnectionUnavailable();
        }

        this.disconnect();
    }

    getActiveTransportName() {
        const activeTransport = this.connection.getTransport();

        return activeTransport && activeTransport.name;
    }

    isPaused() {
        return this.paused;
    }
}

export default Streaming;
