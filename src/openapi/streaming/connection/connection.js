import log from './../../../log';
import WebsocketTransport from './transport/websocket-transport';
import SignalrTransport from './transport/signalr-transport';

const LOG_AREA = 'Connection';
const DEFAULT_TRANSPORTS = [WebsocketTransport, SignalrTransport];

const TRANSPORT_NAME_MAP = {
    // New, plain RAW WebSocket transport.
    [WebsocketTransport.NAME]: WebsocketTransport,

    // Backward compatible mapping to SignalR.
    webSockets: SignalrTransport,
    longPolling: SignalrTransport,
};

const NOOP = () => {};

const STATE_CREATED = 'connection-state-created';
const STATE_STARTED = 'connection-state-started';
const STATE_STOPPED = 'connection-state-stopped';

function getLogDetails() {
    return {
        url: this.baseUrl,
        index: this.tranportIndex,
        contextId: this.contextId,
        enabledTransports: this.options && this.options.transport,
    };
}

function onTransportFail(error) {
    log.info(LOG_AREA, 'Transport failed', {
        error,
        ...getLogDetails.call(this),
    });

    // Try to create next possible transport.
    this.transport = createTransport.call(this, this.baseUrl);

    if (!this.transport) {
        // No next transport available. Report total failure.
        log.warn(LOG_AREA, 'Next supported Transport not found', {
            error,
            ...getLogDetails.call(this),
        });
        this.failCallback();
        return;
    }

    log.debug(LOG_AREA, 'Next supported Transport found', {
        name: this.transport.name,
    });

    this.transport.setReceivedCallback(this.receiveCallback);
    this.transport.setStateChangedCallback(this.stateChangedCallback);
    this.transport.setUnauthorizedCallback(this.unauthorizedCallback);
    this.transport.setConnectionSlowCallback(this.connectionSlowCallback);

    if (this.state === STATE_STARTED) {
        this.transport.updateQuery(this.authToken, this.contextId);
        this.transport.start(this.options, this.startCallback);
    }
}

function createTransport(baseUrl) {
    if (this.tranportIndex === null || this.tranportIndex === undefined) {
        this.tranportIndex = 0;
    } else {
        this.tranportIndex++;
    }

    if (this.tranportIndex > this.transports.length - 1) {
        // No more transports to choose from.
        return null;
    }

    // Create transport from supported transports lists.
    const SelectedTransport = this.transports[this.tranportIndex];

    if (!SelectedTransport.isSupported()) {
        // SelectedTransport transport is not supported by browser. Try to create next possible transport.
        return createTransport.call(this, baseUrl);
    }

    return new SelectedTransport(baseUrl, onTransportFail.bind(this));
}

function getSupportedTransports(transportNames) {
    if (!transportNames) {
        return DEFAULT_TRANSPORTS;
    }

    const supported = [];

    for (let i = 0; i < transportNames.length; i++) {
        const transportName = transportNames[i];

        if (TRANSPORT_NAME_MAP[transportName]) {
            supported.push(TRANSPORT_NAME_MAP[transportName]);
        }
    }

    return supported;
}

/**
 * Connection facade for multiple supported streaming approaches:
 * - WebSocket
 * - SignalR WebSocket/Long Polling (Legacy/Fallback solution).
 */
function Connection(options, baseUrl, failCallback = NOOP) {
    // Callbacks
    this.failCallback = failCallback;
    this.startCallback = NOOP;
    this.stateChangedCallback = NOOP;
    this.receiveCallback = NOOP;
    this.connectionSlowCallback = NOOP;

    // Parameters
    this.baseUrl = baseUrl;
    this.options = options;
    this.authToken = null;
    this.contextId = null;
    this.transports = getSupportedTransports.call(
        this,
        this.options && this.options.transport,
    );

    this.state = STATE_CREATED;

    // Index of currently used transport. Index corresponds to position in this.transports.
    this.tranportIndex = null;
    this.transport = createTransport.call(this, this.baseUrl);

    if (!this.transport) {
        // No next transport available. Report total failure.
        log.error(
            LOG_AREA,
            'Supported Transport not found.',
            getLogDetails.call(this),
        );
        throw new Error('Unable to setup initial transport.');
    } else {
        log.debug(LOG_AREA, 'Supported Transport found', {
            name: this.transport.name,
        });
    }
}

Connection.prototype.setUnauthorizedCallback = function(callback) {
    if (this.transport) {
        this.unauthorizedCallback = callback;
        this.transport.setUnauthorizedCallback(callback);
    }
};

Connection.prototype.setStateChangedCallback = function(callback) {
    if (this.transport) {
        this.stateChangedCallback = callback;
        this.transport.setStateChangedCallback(callback);
    }
};

Connection.prototype.setReceivedCallback = function(callback) {
    if (this.transport) {
        this.receiveCallback = callback;
        this.transport.setReceivedCallback(callback);
    }
};

Connection.prototype.setConnectionSlowCallback = function(callback) {
    if (this.transport) {
        this.connectionSlowCallback = callback;
        this.transport.setConnectionSlowCallback(callback);
    }
};

Connection.prototype.start = function(callback) {
    if (this.transport) {
        this.state = STATE_STARTED;
        this.startCallback = callback;
        this.transport.start(this.options, this.startCallback);
        log.debug(LOG_AREA, 'Connection started');
    }
};

Connection.prototype.stop = function() {
    if (this.transport) {
        this.state = STATE_STOPPED;
        this.transport.stop();
        log.debug(LOG_AREA, 'Connection stopped');
    }
};

Connection.prototype.updateQuery = function(
    authToken,
    contextId,
    forceAuth = false,
) {
    this.authToken = authToken;
    this.contextId = contextId;

    log.debug(LOG_AREA, 'Connection update query', {
        contextId,
        authToken,
    });

    if (this.transport) {
        this.transport.updateQuery(this.authToken, this.contextId, forceAuth);
    }
};

Connection.prototype.getQuery = function() {
    if (this.transport) {
        return this.transport.getQuery();
    }
};

Connection.prototype.onOrphanFound = function() {
    if (this.transport && this.transport.onOrphanFound) {
        this.transport.onOrphanFound();
    }
};

Connection.prototype.onSubscribeNetworkError = function() {
    if (this.transport && this.transport.onSubscribeNetworkError) {
        this.transport.onSubscribeNetworkError();
    }
};

/**
 * Get underlying transport
 * @returns {*}
 */
Connection.prototype.getTransport = function() {
    if (!this.transport) {
        return null;
    }

    // Legacy check for SignalR transport.
    if (this.transport.hasOwnProperty('getTransport')) {
        return this.transport.getTransport();
    }

    return this.transport;
};

export default Connection;
