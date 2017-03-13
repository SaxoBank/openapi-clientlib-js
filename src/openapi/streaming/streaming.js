/**
 * @module saxo/openapi/streaming/streaming
 * @ignore
 */

import emitter from '../../micro-emitter';
import Subscription from './subscription';
import StreamingOrphanFinder from './orphan-finder';
import log from '../../log';
import { padLeft } from '../../utils/string';

//-- Local variables section --

const OPENAPI_CONTROL_MESSAGE_PREFIX = "_";
const OPENAPI_CONTROL_MESSAGE_HEARTBEAT = "_heartbeat";
const OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS = "_resetsubscriptions";

const DEFAULT_CONNECT_RETRY_DELAY = 1000;
const MS_TO_IGNORE_DATA_ON_UNSUBSCRIBED = 3000;

const LOG_AREA = "Streaming";

const ignoreSubscriptions = {};

//-- Local methods section --

/**
 * initializes the SignalR connection, and starts handling streaming events.
 *
 * This method initiates a SignalR connection. The Streaming connection.
 * starts in an Initialising state, transitions to Started when the SignalR connection starts
 * then follows the SignalR state model.
 */
function init() {

	setNewContextId.call(this);

	var connection = $.connection(this.connectionUrl);
	connection.log = onSignalRLog;
	this.connection = connection;
	updateConnectionQuery.call(this);

	connection.stateChanged(onConnectionStateChanged.bind(this));
	connection.received(onReceived.bind(this));
	connection.error(onConnectionError.bind(this));
	connection.connectionSlow(onConnectionSlow.bind(this));

	// start the connection process
	connection.start(this.signalrStartOptions, onConnectionStarted.bind(this));
}

/**
 * Reconnects the streaming socket when it is disconnected
 */
function reconnect() {

	if (this.connectionState !== this.CONNECTION_STATE_DISCONNECTED) {
		throw new Error("Only call reconnect on a disconnected streaming connection");
	}

	setNewContextId.call(this);
	updateConnectionQuery.call(this);

	this.reconnecting = true;

	this.connection.start(onConnectionStarted.bind(this));
}

function setNewContextId() {
	// context id must be 10 characters or less.
	// using the recommended technique for generating a context id
	// from https://wiki/display/OpenAPI/Open+API+Streaming

	var now = new Date();
	var midnight = new Date(now.toDateString());
	var msSinceMidnight = now - midnight;
	var randomNumber = Math.floor(Math.random() * 100);

	var contextId = padLeft(String(msSinceMidnight), 8, "0") + padLeft(String(randomNumber), 2, "0");
	this.contextId = contextId;
	for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
		subscription.streamingContextId = contextId;
	}
}

/**
 * Retries the connection after a time
 */
function retryConnection() {
	setTimeout(reconnect.bind(this), this.retryDelay);
}

/**
 * maps from the signalR connection state to the ConnectionState Enum
 */
function mapConnectionState(state) {
	var connectionState;
	switch (state) {
		case $.signalR.connectionState.connecting: connectionState = this.CONNECTION_STATE_CONNECTING; break;
		case $.signalR.connectionState.connected: connectionState =  this.CONNECTION_STATE_CONNECTED;  break;
		case $.signalR.connectionState.disconnected: connectionState =  this.CONNECTION_STATE_DISCONNECTED; break;
		case $.signalR.connectionState.reconnecting: connectionState =  this.CONNECTION_STATE_RECONNECTING; break;
		default:
			log.warn(LOG_AREA, "unrecognised state", state);
			break;
	}

	return connectionState;
}

/**
 * handles connection state changed event from signalR
 */
function onConnectionStateChanged(change) {

	this.connectionState = mapConnectionState.call(this, change.newState);

	var signalRTransport = this.connection.transport;
	log.info(LOG_AREA, "Connection state changed to ", { changedTo: this.READABLE_CONNECTION_STATE_MAP[this.connectionState], mechanism: signalRTransport && signalRTransport.name });
	this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);

	if (this.disposed) {
		return;
	}

	switch(this.connectionState) {
		case this.CONNECTION_STATE_DISCONNECTED:

			log.error(LOG_AREA, "connection disconnected");

			this.orphanFinder.stop();

			// tell all subscriptions not to do anything
			// it doesn't matter if they do (they will be reset and either forget the unsubscribe or start a new subscribe),
			// but it is a waste of network
			for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
				subscription.onConnectionUnavailable();
			}

			retryConnection.call(this);
			break;
		case this.CONNECTION_STATE_RECONNECTING:

			updateConnectionQuery.call(this);

			this.orphanFinder.stop();
			break;
		case this.CONNECTION_STATE_CONNECTED:

			// if *we* are reconnecting (as opposed to signal-r reconnecting, which we do not need to handle specially)
			if (this.reconnecting) {
				resetAllSubscriptions.call(this);
				this.reconnecting = false;
			}

			for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
				subscription.onConnectionAvailable();
			}

			this.orphanFinder.start();
			break;
	}
}

/**
 * handles the signalR connect start callback
 */
function onConnectionStarted(change) {
	// sometimes the started gets called after connected, sometimes before
	if (this.connectionState === this.CONNECTION_STATE_INITIALIZING) {
		this.connectionState = this.CONNECTION_STATE_STARTED;
	}

	log.info(LOG_AREA, "Connection started");

	this.trigger(this.EVENT_CONNECTION_STATE_CHANGED, this.connectionState);
}

/**
 * handles the connection received event from SignalR
 * @param updates
 */
function onReceived(updates) {

	if (!updates) {
		log.warn(LOG_AREA, "onReceived called with no data", updates);
		return;
	}

	for(let i = 0, update; update = updates[i]; i++) {
		try {
			if (update.ReferenceId[0] === OPENAPI_CONTROL_MESSAGE_PREFIX) {
				handleControlMessage.call(this, update);
			} else {
				sendDataUpdateToSubscribers.call(this, update);
			}
		}
		catch(error) {
			log.error(LOG_AREA, "Error occurred in onReceived procssing update", { error: error, update: update });
		}
	}
}

/**
 * Finds a subscription by referenceId or returns undefined if not found
 * @param {string} referenceId
 */
function findSubscriptionByReferenceId(referenceId) {
	for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
		if (subscription.referenceId === referenceId) {
			return subscription;
		}
	}
}

/**
 * Sends an update to a subscription by finding it and calling its callback
 * @param update
 */
function sendDataUpdateToSubscribers(update) {
	var subscription = findSubscriptionByReferenceId.call(this, update.ReferenceId);
	if (!subscription || subscription.onStreamingData(update) === false) {
		const logFunction = ignoreSubscriptions[update.ReferenceId] ? log.debug : log.warn;
		logFunction.call(log, LOG_AREA, "Data update does not match a subscription", update);
	}
}

/**
 * Handles a control message on the streaming connection
 * @param {Object} message From open-api
 */
function handleControlMessage(message) {
	switch(message.ReferenceId) {
		case OPENAPI_CONTROL_MESSAGE_HEARTBEAT:
			fireHeartbeats.call(this, message.Heartbeats);
			break;
		case OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS:
			resetSubscriptions.call(this, message.TargetReferenceIds);
			break;
		default:
			log.warn(LOG_AREA, "Unrecognised control message", message);
			break;
	}
}

/**
 * fires heartbeats to relevant subscriptions
 * @param {Array.<{OriginatingReferenceId: string, Reason: string}>} heartbeatList
 */
function fireHeartbeats(heartbeatList) {

	log.debug(LOG_AREA, "heartbeats received", heartbeatList);
	for(let i = 0, heartbeat; heartbeat = heartbeatList[i]; i++) {
		let subscription = findSubscriptionByReferenceId.call(this, heartbeat.OriginatingReferenceId);
		if (subscription) {
			subscription.onHeartbeat();
		} else {
			const logFunction = ignoreSubscriptions[heartbeat.OriginatingReferenceId] ? log.debug : log.warn;
			logFunction.call(log, LOG_AREA, "heartbeat received for non-found subscription", heartbeat);
		}
	}
}

/**
 * Resets all subscriptions
 */
function resetAllSubscriptions() {
	log.warn(LOG_AREA, "Resetting all subscriptions");
	for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
		subscription.reset();
	}
}

/**
 * Resets a particular subscription
 * @param {Array.<string>} referenceIdList
 */
function resetSubscriptions(referenceIdList) {

	if (!referenceIdList || !referenceIdList.length) {
		resetAllSubscriptions.call(this);
		return;
	}

	log.debug(LOG_AREA, "Resetting subscriptions", referenceIdList);

	for(let i = 0, referenceId; referenceId = referenceIdList[i]; i++) {
		let subscription = findSubscriptionByReferenceId.call(this, referenceId);
		if (subscription) {
			subscription.reset();
		} else {
			const logFunction = ignoreSubscriptions[referenceId] ? log.debug : log.warn;
			logFunction.call(log, LOG_AREA, "couldn't find subscription to reset", referenceId);
		}
	}
}

/**
 * handles the connection slow event from SignalR. Happens when a keep-alive is missed.
 */
function onConnectionSlow() {
	log.info(LOG_AREA, "connection is slow");
	this.trigger(this.EVENT_CONNECTION_SLOW);
}

/**
 * handles a signal-r error
 * This occurs when data cannot be sent, or cannot be received or something unknown goes wrong.
 * signal-r attempts to keep the subscription and if it doesn't we will get the normal failed events
 */
function onConnectionError(errorDetail) {
	log.error(LOG_AREA, "connection error", errorDetail);
}

/**
 * Overrides the signalr log in order to channel log messages into our logger
 * @param message
 */
function onSignalRLog(message) {
	log.debug("SignalR", message);
}

/**
 * Updates the connection query string
 */
function updateConnectionQuery() {
	this.connection.qs = 'authorization=' + encodeURIComponent(this.authProvider.getToken()) + '&context=' + encodeURIComponent(this.contextId);
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
	log.warn(LOG_AREA, "Subscription has become orphaned - resetting", subscription);
	subscription.reset();
}

//-- Exported methods section --

/**
 * Manages subscriptions to the Open API streaming service.
 * Once created this will immediately attempt to start the streaming service
 *
 * @class
 * @alias saxo.openapi.Streaming
 * @mixes MicroEmitter
 * @param {Transport} transport - The transport to use for subscribing/unsubscribing.
 * @param {string} baseUrl - The base URL with which to connect. /streaming/connection will be appended to it.
 * @param {Object} authProvider - An object with the method getToken on it.
 * @param {Object} [options] - The configuration options for the streaming connection
 * @param {number} [options.connectRetryDelay=1000] - The delay in milliseconds to wait before attempting a new connect after signal-r has disconnected
 * @param {Boolean} [options.waitForPageLoad=true] - Whether the signal-r streaming connection waits for page load before starting
 * @param {Array.<string>} [options.transportTypes=['webSockets', 'longPolling']] - The transports to be used in order by signal-r.
 */
function Streaming(transport, baseUrl, authProvider, options) {

	emitter.mixinTo(this);

	this.connectionState = this.CONNECTION_STATE_INITIALIZING;
	this.connectionUrl = baseUrl + "/streaming/connection";
	this.authProvider = authProvider;
	this.transport = transport;
	this.subscriptions = [];

	this.signalrStartOptions = {
		waitForPageLoad: (options && options.waitForPageLoad) || false, 				// faster and does not cause problems after IE8
		transport: (options && options.transportTypes) || ['webSockets',' longPolling']	// SignalR has a bug in SSE and forever frame is slow
	};

	if (options && typeof options.connectRetryDelay === "number") {
		this.retryDelay = options.connectRetryDelay;
	} else {
		this.retryDelay = DEFAULT_CONNECT_RETRY_DELAY;
	}

	this.orphanFinder = new StreamingOrphanFinder(this.subscriptions, onOrphanFound.bind(this));

	init.call(this);
}

/**
 * Event that occurs when the connection state changes.
 */
Streaming.prototype.EVENT_CONNECTION_STATE_CHANGED = "connectionStateChanged";
/**
 * Event that occurs when the connection is slow.
 */
Streaming.prototype.EVENT_CONNECTION_SLOW = "connectionSlow";

/**
 * Streaming has been created but has not yet started the connection.
 */
Streaming.prototype.CONNECTION_STATE_INITIALIZING = 0x1;
/**
 * The connection has been started but signal-r may not yet be connecting.
 */
Streaming.prototype.CONNECTION_STATE_STARTED = 0x2;
/**
 * signal-r is trying to connect. The previous state was CONNECTION_STATE_STARTED or CONNECTION_STATE_DISCONNECTED.
 */
Streaming.prototype.CONNECTION_STATE_CONNECTING = 0x4;
/**
 * signal-r is connected and everything is good.
 */
Streaming.prototype.CONNECTION_STATE_CONNECTED = 0x8;
/**
 * signal-r is reconnecting. The previous state was CONNECTION_STATE_CONNECTING.
 * We are current not connected, but might recover without having to reset.
 */
Streaming.prototype.CONNECTION_STATE_RECONNECTING = 0x10;
/**
 * signal-r is disconnected. Streaming may attempt to connect again.
 */
Streaming.prototype.CONNECTION_STATE_DISCONNECTED = 0x20;

Streaming.prototype.READABLE_CONNECTION_STATE_MAP = {
	[Streaming.prototype.CONNECTION_STATE_INITIALIZING]: "Initializing",
	[Streaming.prototype.CONNECTION_STATE_STARTED]: "Started",
	[Streaming.prototype.CONNECTION_STATE_CONNECTING]: "Connecting",
	[Streaming.prototype.CONNECTION_STATE_CONNECTED]: "Connected",
	[Streaming.prototype.CONNECTION_STATE_RECONNECTING]: "Reconnecting",
	[Streaming.prototype.CONNECTION_STATE_DISCONNECTED]: "Disconnected",
};

/**
 * Constructs a new subscription to the given resource.
 *
 * @param {string} serviceGroup - The service group e.g. 'trade'
 * @param {string} url - The name of the resource to subscribe to, e.g. '/v1/infoprices/subscriptions'.
 * @param {object} subscriptionArgs - Arguments that detail the subscription.
 * @param {number} [subscriptionArgs.RefreshRate=1000] - The data refresh rate (passed to OpenAPI).
 * @param {string} [subscriptionArgs.Tag] - The tag for the subscription (passed to OpenAPI).
 * @param {string} [subscriptionArgs.Format] - The format for the subscription (passed to OpenAPI).
 * @param {object} [subscriptionArgs.Arguments] - The subscription arguments (passed to OpenAPI).
 * @param {function} onUpdate - A callback function that is invoked when an initial snapshot or update is received.
 *                              The first argument will be the data received and the second argument will either be
 *                              subscription.UPDATE_TYPE_DELTA or subscription.UPDATE_TYPE_SNAPSHOT
 * @param {function} onError - A callback function that is invoked when an error occurs.
 * @returns {saxo.openapi.StreamingSubscription} A subscription object.
 */
Streaming.prototype.createSubscription = function(serviceGroup, url, subscriptionArgs, onUpdate, onError) {

	var subscription = new Subscription(this.contextId, this.transport, serviceGroup, url, subscriptionArgs, onSubscriptionCreated.bind(this), onUpdate, onError);

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
Streaming.prototype.subscribe = function(subscription) {

	subscription.onSubscribe();
};

/**
 * Makes a subscription start with modification.
 * Modify subscription will keep pending unsubscribe followed by modify subscribe.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to modify.
 */
Streaming.prototype.modify = function(subscription) {

	subscription.onSubscribe(true);
};

/**
 * Makes a subscription stop (can be restarted). See {@link saxo.openapi.Streaming#disposeSubscription} for permanently stopping a subscription.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to stop.
 */
Streaming.prototype.unsubscribe = function(subscription) {

	ignoreSubscriptions[subscription.referenceId] = true;
	setTimeout(() => delete ignoreSubscriptions[subscription.referenceId], MS_TO_IGNORE_DATA_ON_UNSUBSCRIBED);
	subscription.onUnsubscribe();
};

/**
 * Disposes a subscription permanently. It will be stopped and not be able to be started.
 *
 * @param {saxo.openapi.StreamingSubscription} subscription - The subscription to stop and remove.
 */
Streaming.prototype.disposeSubscription = function(subscription) {

	this.unsubscribe(subscription);
	subscription.dispose();
	var indexOfSubscription = this.subscriptions.indexOf(subscription);
	if (indexOfSubscription >= 0) {
		this.subscriptions.splice(indexOfSubscription, 1);
	}
};

/**
 * This disconnects the current socket. We will follow normal reconnection logic to try and restore the connection.
 * It *will not* stop the subscription (see dispose for that). It is useful for testing reconnect logic works or for resetting all subscriptions.
 */
Streaming.prototype.disconnect = function() {
	this.connection.stop();
};

/**
 * Shuts down streaming.
 */
Streaming.prototype.dispose = function() {

	this.disposed = true;

	this.orphanFinder.stop();

	for(let i = 0, subscription; subscription = this.subscriptions[i]; i++) {
		// disconnecting *should* shut down all subscriptions. We also delete all below.
		// So mark the subscription as not having a connection and reset it so its state becomes unsubscribed
		subscription.onConnectionUnavailable();
		subscription.reset();
	}
	this.subscriptions.length = 0;

	// delete all subscriptions on this context id
	this.transport.delete("root" ,"v1/subscriptions/{contextId}", { contextId: this.contextId });

	this.disconnect();
};

//-- Export section --

export default Streaming;
