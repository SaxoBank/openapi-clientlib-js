import log from '../../../../log';
import * as constants from './../constants';

const NAME = 'signalr';
const LOG_AREA = 'SignalRTransport';
const NOOP = () => {};

/**
 * Maps from the signalR connection state to the ConnectionState Enum
 */
function mapConnectionState(state) {
    switch (state) {
        case $.signalR.connectionState.connecting:
            return constants.CONNECTION_STATE_CONNECTING;

        case $.signalR.connectionState.connected:
            return constants.CONNECTION_STATE_CONNECTED;

        case $.signalR.connectionState.disconnected:
            return constants.CONNECTION_STATE_DISCONNECTED;

        case $.signalR.connectionState.reconnecting:
            return constants.CONNECTION_STATE_RECONNECTING;

        default:
            log.warn(LOG_AREA, 'unrecognised state', state);
            break;
    }

    return null;
}

/**
 * Handles a signal-r error
 * This occurs when data cannot be sent, or cannot be received or something unknown goes wrong.
 * signal-r attempts to keep the subscription and if it doesn't we will get the normal failed events
 */
function handleError(errorDetail) {
    log.error(LOG_AREA, 'Transport error', errorDetail);
    if (errorDetail && errorDetail.source && errorDetail.source.status === 401) {
        this.unauthorizedCallback();
    }
    if (typeof this.errorCallback === 'function') {
        this.errorCallback(errorDetail);
    }
}

/**
 * Handles any signal-r log, and pipes it through our logging.
 * @param message
 */
function handleLog(message) {
    log.debug(LOG_AREA, message);
}

function handleStateChanged(payload) {
    if (typeof this.stateChangedCallback === 'function') {
        this.stateChangedCallback(mapConnectionState.call(this, payload.newState));
    }
}

/**
 * SignalR Transport which supports both webSocket and longPolling with internal fallback mechanism.
 */
function SignalrTransport(baseUrl) {
    this.name = NAME;
    this.baseUrl = baseUrl;
    this.connectionUrl = `${baseUrl}/streaming/connection`;
    this.connection = $.connection(this.connectionUrl);
    this.transport = null;
    this.stateChangedCallback = NOOP;
    this.errorCallback = NOOP;
    this.unauthorizedCallback = NOOP;
    this.connection.stateChanged(handleStateChanged.bind(this));
    this.connection.log = handleLog.bind(this);
    this.connection.error(handleError.bind(this));
}

SignalrTransport.NAME = NAME;

SignalrTransport.isSupported = function() {
    return true;
};

SignalrTransport.prototype.isSupported = SignalrTransport.isSupported;

SignalrTransport.prototype.setUnauthorizedCallback = function(callback) {
    this.unauthorizedCallback = callback;
};

SignalrTransport.prototype.setStateChangedCallback = function(callback) {
    this.stateChangedCallback = callback;
};

SignalrTransport.prototype.setReceivedCallback = function(callback) {
    this.connection.received(callback);
};

SignalrTransport.prototype.setErrorCallback = function(callback) {
    this.errorCallback = callback;
};

SignalrTransport.prototype.setConnectionSlowCallback = function(callback) {
    this.connection.connectionSlow(callback);
};

SignalrTransport.prototype.start = function(options, callback) {
    this.connection.start(options, callback);
};

SignalrTransport.prototype.stop = function() {
    this.connection.stop();
};

SignalrTransport.prototype.updateQuery = function(authToken, contextId) {
    this.connection.qs = `authorization=${encodeURIComponent(authToken)}&context=${encodeURIComponent(contextId)}`;
};

SignalrTransport.prototype.getQuery = function() {
    return this.connection.qs;
};

SignalrTransport.prototype.getTransport = function() {
    return this.connection.transport;
};

export default SignalrTransport;
