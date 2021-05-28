import log from './../../../log';
import * as transportTypes from './transportTypes';
import WebsocketTransport from './transport/websocket-transport';
import SignalrTransport from './transport/signalr-transport';
import SignalrCoreTransport from './transport/signalr-core-transport';

const LOG_AREA = 'Connection';
const DEFAULT_TRANSPORTS = [
    transportTypes.PLAIN_WEBSOCKETS,
    transportTypes.LEGACY_SIGNALR_WEBSOCKETS,
];

const TRANSPORT_NAME_MAP = {
    [transportTypes.SIGNALR_CORE_WEBSOCKETS]: {
        options: {
            transportType: transportTypes.SIGNALR_CORE_WEBSOCKETS,
            skipNegotiation: true,
        },
        instance: SignalrCoreTransport,
    },
    [transportTypes.SIGNALR_CORE_LONG_POLLING]: {
        options: {
            transportType: transportTypes.SIGNALR_CORE_LONG_POLLING,
            skipNegotiation: false,
        },
        instance: SignalrCoreTransport,
    },
    [transportTypes.PLAIN_WEBSOCKETS]: {
        options: {},
        instance: WebsocketTransport,
    },

    // Backward compatible mapping to legacy signalR.
    [transportTypes.LEGACY_SIGNALR_WEBSOCKETS]: {
        options: {},
        instance: SignalrTransport,
    },
    [transportTypes.LEGACY_SIGNALR_LONG_POLLING]: {
        options: {},
        instance: SignalrTransport,
    },
};

const NOOP = () => {};

const STATE_CREATED = 'connection-state-created';
const STATE_STARTED = 'connection-state-started';
const STATE_STOPPED = 'connection-state-stopped';
const STATE_DISPOSED = 'connection-state-disposed';

function getLogDetails() {
    return {
        url: this.baseUrl,
        index: this.tranportIndex,
        contextId: this.contextId,
        enabledTransports: this.options && this.options.transport,
    };
}

function ensureValidState(callback, callbackType, ...args) {
    if (this.state === STATE_DISPOSED) {
        log.warn(LOG_AREA, 'callback called after transport was disposed', {
            callback: callbackType,
            transport: this.transport.name,
            contextId: this.contextId,
        });
        return;
    }

    callback(...args);
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
        this.transport.updateQuery(
            this.authToken,
            this.contextId,
            this.authExpiry,
        );
        const transportOptions = {
            ...this.transports[this.tranportIndex].options,
            ...this.options,
        };
        this.transport.start(transportOptions, this.startCallback);
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
    const SelectedTransport = this.transports[this.tranportIndex].instance;

    if (!SelectedTransport.isSupported()) {
        // SelectedTransport transport is not supported by browser. Try to create next possible transport.
        return createTransport.call(this, baseUrl);
    }

    return new SelectedTransport(baseUrl, onTransportFail.bind(this));
}

function getSupportedTransports(requestedTrasnports) {
    let transportNames = requestedTrasnports;
    if (!transportNames) {
        transportNames = DEFAULT_TRANSPORTS;
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
    this.authExpiry = null;
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
            'Unable to setup initial transport. Supported Transport not found.',
            getLogDetails.call(this),
        );

        failCallback();
    } else {
        log.debug(LOG_AREA, 'Supported Transport found', {
            name: this.transport.name,
        });
    }
}

Connection.prototype.setUnauthorizedCallback = function (callback) {
    if (this.transport) {
        this.unauthorizedCallback = ensureValidState.bind(
            this,
            callback,
            'unauthorizedCallback',
        );
        this.transport.setUnauthorizedCallback(this.unauthorizedCallback);
    }
};

Connection.prototype.setStateChangedCallback = function (callback) {
    if (this.transport) {
        this.stateChangedCallback = ensureValidState.bind(
            this,
            callback,
            'stateChangedCallback',
        );
        this.transport.setStateChangedCallback(this.stateChangedCallback);
    }
};

Connection.prototype.setReceivedCallback = function (callback) {
    if (this.transport) {
        this.receiveCallback = ensureValidState.bind(
            this,
            callback,
            'receivedCallback',
        );
        this.transport.setReceivedCallback(this.receiveCallback);
    }
};

Connection.prototype.setConnectionSlowCallback = function (callback) {
    if (this.transport) {
        this.connectionSlowCallback = ensureValidState.bind(
            this,
            callback,
            'connectionSlowCallback',
        );
        this.transport.setConnectionSlowCallback(this.connectionSlowCallback);
    }
};

Connection.prototype.start = function (callback) {
    if (this.transport) {
        this.state = STATE_STARTED;
        this.startCallback = callback;

        const transportOptions = {
            ...this.transports[this.tranportIndex].options,
            ...this.options,
        };
        this.transport.start(transportOptions, this.startCallback);
    }
};

Connection.prototype.stop = function () {
    if (this.transport) {
        this.state = STATE_STOPPED;
        this.transport.stop();
    }
};

Connection.prototype.dispose = function () {
    this.state = STATE_DISPOSED;
};

Connection.prototype.updateQuery = function (
    authToken,
    contextId,
    authExpiry,
    forceAuth = false,
) {
    this.authToken = authToken;
    this.contextId = contextId;
    this.authExpiry = authExpiry;

    log.debug(LOG_AREA, 'Connection update query', {
        contextId,
        authExpiry,
    });

    if (this.transport) {
        this.transport.updateQuery(
            this.authToken,
            this.contextId,
            this.authExpiry,
            forceAuth,
        );
    }
};

Connection.prototype.getQuery = function () {
    if (this.transport) {
        return this.transport.getQuery();
    }
};

Connection.prototype.onOrphanFound = function () {
    if (this.transport && this.transport.onOrphanFound) {
        this.transport.onOrphanFound();
    }
};

Connection.prototype.onSubscribeNetworkError = function () {
    if (this.transport && this.transport.onSubscribeNetworkError) {
        this.transport.onSubscribeNetworkError();
    }
};

/**
 * Get underlying transport
 * @returns {*}
 */
Connection.prototype.getTransport = function () {
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
