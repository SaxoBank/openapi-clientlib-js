import log from './../../../log';
import * as transportTypes from './transportTypes';
import WebsocketTransport from './transport/websocket-transport';
import SignalrTransport from './transport/signalr-transport';
import SignalrCoreTransport from './transport/signalr-core-transport';
import type { TransportTypes, ConnectionOptions } from '../types';
import type {
    StreamingTransportInterface,
    ReceiveCallback,
    StateChangeCallback,
} from './types';

const LOG_AREA = 'Connection';
const DEFAULT_TRANSPORTS = [
    transportTypes.PLAIN_WEBSOCKETS,
    transportTypes.LEGACY_SIGNALR_WEBSOCKETS,
];

export const TRANSPORT_NAME_MAP = {
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

/**
 * Connection facade for multiple supported streaming approaches:
 * - WebSocket
 * - SignalR WebSocket/Long Polling (Legacy/Fallback solution).
 */
class Connection {
    baseUrl: string;
    failCallback: () => void;
    startCallback = NOOP;
    stateChangedCallback = NOOP;
    receiveCallback: ReceiveCallback = NOOP;
    connectionSlowCallback = NOOP;
    subscriptionResetCallback = NOOP;
    authToken: string | null = null;
    authExpiry: number | null | undefined = null;
    contextId: string | null = null;
    options: ConnectionOptions;
    transports: Array<
        typeof TRANSPORT_NAME_MAP[keyof typeof TRANSPORT_NAME_MAP]
    >;
    state = STATE_CREATED;
    transportIndex: number | null = null;
    transport: StreamingTransportInterface | null;
    unauthorizedCallback = NOOP;

    constructor(
        options: ConnectionOptions,
        baseUrl: string,
        failCallback = NOOP,
    ) {
        // Callbacks
        this.failCallback = failCallback;

        // Parameters
        this.baseUrl = baseUrl;
        this.options = options;
        this.transports = this.getSupportedTransports(this.options.transport);

        // Index of currently used transport. Index corresponds to position in this.transports.
        this.transport = this.createTransport(this.baseUrl);

        if (!this.transport) {
            // No next transport available. Report total failure.
            log.error(
                LOG_AREA,
                'Unable to setup initial transport. Supported Transport not found.',
                this.getLogDetails(),
            );

            failCallback();
        } else {
            log.debug(LOG_AREA, 'Supported Transport found', {
                name: this.transport.name,
            });
        }
    }

    private getLogDetails() {
        return {
            url: this.baseUrl,
            index: this.transportIndex,
            contextId: this.contextId,
            enabledTransports: this.options?.transport,
        };
    }

    private ensureValidState = (
        callback: (...args: any[]) => void,
        callbackType: string,
        ...args: unknown[]
    ) => {
        if (this.state === STATE_DISPOSED) {
            log.warn(LOG_AREA, 'callback called after transport was disposed', {
                callback: callbackType,
                transport: this.transport?.name,
                contextId: this.contextId,
            });
            return;
        }

        callback(...args);
    };

    private onTransportFail = (error?: Record<string, unknown>) => {
        log.info(LOG_AREA, 'Transport failed', {
            error,
            ...this.getLogDetails(),
        });

        // Try to create next possible transport.
        this.transport = this.createTransport(this.baseUrl);

        if (!this.transport) {
            // No next transport available. Report total failure.
            log.warn(LOG_AREA, 'Next supported Transport not found', {
                error,
                ...this.getLogDetails(),
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

        if (typeof this.transport.setSubscriptionResetCallback === 'function') {
            this.transport.setSubscriptionResetCallback(
                this.subscriptionResetCallback,
            );
        }

        if (this.state === STATE_STARTED) {
            this.transport.updateQuery(
                this.authToken as string,
                this.contextId as string,
                this.authExpiry,
            );
            const transportOptions = {
                ...this.transports[this.transportIndex as number].options,
                ...this.options,
            };
            this.transport.start(transportOptions, this.startCallback);
        }
    };

    private createTransport(
        baseUrl: string,
    ): StreamingTransportInterface | null {
        if (this.transportIndex === null || this.transportIndex === undefined) {
            this.transportIndex = 0;
        } else {
            this.transportIndex++;
        }

        if (this.transportIndex > this.transports.length - 1) {
            // No more transports to choose from.
            return null;
        }

        // Create transport from supported transports lists.
        const SelectedTransport = this.transports[this.transportIndex].instance;

        if (!SelectedTransport.isSupported()) {
            // SelectedTransport transport is not supported by browser. Try to create next possible transport.
            return this.createTransport(baseUrl);
        }

        return new SelectedTransport(baseUrl, this.onTransportFail);
    }

    private getSupportedTransports(
        requestedTrasnports?: Array<TransportTypes>,
    ) {
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

    setUnauthorizedCallback(callback: () => void) {
        if (this.transport) {
            this.unauthorizedCallback = this.ensureValidState.bind(
                this,
                callback,
                'unauthorizedCallback',
            );
            this.transport.setUnauthorizedCallback(this.unauthorizedCallback);
        }
    }

    setStateChangedCallback(callback: StateChangeCallback) {
        if (this.transport) {
            this.stateChangedCallback = this.ensureValidState.bind(
                this,
                callback,
                'stateChangedCallback',
            );
            this.transport.setStateChangedCallback(this.stateChangedCallback);
        }
    }

    setReceivedCallback(callback: ReceiveCallback) {
        if (this.transport) {
            this.receiveCallback = this.ensureValidState.bind(
                this,
                callback,
                'receivedCallback',
            );
            this.transport.setReceivedCallback(this.receiveCallback);
        }
    }

    setConnectionSlowCallback(callback: () => void) {
        if (this.transport) {
            this.connectionSlowCallback = this.ensureValidState.bind(
                this,
                callback,
                'connectionSlowCallback',
            );
            this.transport.setConnectionSlowCallback(
                this.connectionSlowCallback,
            );
        }
    }

    setSubscriptionResetCallback(callback: () => void) {
        if (
            this.transport &&
            typeof this.transport.setSubscriptionResetCallback === 'function'
        ) {
            this.setSubscriptionResetCallback = this.ensureValidState.bind(
                this,
                callback,
                'setSubscriptionResetCallback',
            );
            this.transport.setSubscriptionResetCallback(
                this.subscriptionResetCallback,
            );
        }
    }

    start(callback: () => void) {
        if (this.transport) {
            this.state = STATE_STARTED;
            this.startCallback = callback;

            const transportOptions = {
                ...this.transports[this.transportIndex as number].options,
                ...this.options,
            };
            this.transport.start(transportOptions, this.startCallback);
        }
    }

    stop() {
        if (this.transport) {
            this.state = STATE_STOPPED;
            this.transport.stop();
        }
    }

    dispose() {
        this.state = STATE_DISPOSED;
    }

    updateQuery(
        authToken: string,
        contextId: string,
        authExpiry?: number,
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
    }

    getQuery() {
        return this.transport?.getQuery?.();
    }

    onOrphanFound() {
        this.transport?.onOrphanFound?.();
    }

    onSubscribeNetworkError() {
        this.transport?.onSubscribeNetworkError?.();
    }

    /**
     * Get underlying transport
     *
     */
    getTransport(): StreamingTransportInterface | null {
        if (!this.transport) {
            return null;
        }

        // Legacy check for SignalR transport.
        if (this.transport.hasOwnProperty('getTransport')) {
            // @ts-expect-error - transport exists
            return this.transport.getTransport();
        }

        return this.transport;
    }
}

export default Connection;
