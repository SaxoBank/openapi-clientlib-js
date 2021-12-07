import log from '../../../../log';
import * as transportTypes from '../transportTypes';
import * as constants from '../constants';
import type {
    StateChangeCallback,
    StreamingTransportInterface,
    ReceiveCallback,
} from '../types';

const LOG_AREA = 'SignalRTransport';
const NOOP = () => {};

/**
 * SignalR Transport which supports both webSocket and longPolling with internal fallback mechanism.
 */
class SignalrTransport implements StreamingTransportInterface {
    name = transportTypes.LEGACY_SIGNALR;
    transport = null;
    stateChangedCallback: StateChangeCallback = NOOP;
    unauthorizedCallback: (url: string) => void = NOOP;
    baseUrl: string;
    connectionUrl: string;
    connection: SignalR.Connection;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.connectionUrl = `${baseUrl}/streaming/connection`;
        this.connection = $.connection(this.connectionUrl);

        this.connection.stateChanged(this.handleStateChanged);
        // @ts-expect-error we don't return Connection from the handleLog callback
        this.connection.log = this.handleLog;
        this.connection.error(this.handleError);
    }

    /**
     * Handles any signal-r log, and pipes it through our logging.
     * @param message - message
     */
    private handleLog = (message: string) => {
        log.debug(
            LOG_AREA,
            message.replace(/BEARER[^&]+/i, '[Redacted Token]'),
        );
    };

    /**
     * Handles a signal-r error
     * This occurs when data cannot be sent, or cannot be received or something unknown goes wrong.
     * signal-r attempts to keep the subscription and if it doesn't we will get the normal failed events
     */
    private handleError = (errorDetail: SignalR.ConnectionError) => {
        log.warn(LOG_AREA, 'Transport error', errorDetail);
        // @ts-expect-error FIXME according to types definition status exists on context not source - verify
        if (errorDetail?.source?.status === 401) {
            this.unauthorizedCallback(this.connectionUrl);
        }
    };

    /**
     * Maps from the signalR connection state to the ConnectionState Enum
     */

    private mapConnectionState = (state: number) => {
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
                log.warn(LOG_AREA, 'Unrecognised state', { state });
                break;
        }

        return null;
    };

    private handleStateChanged = (payload: SignalR.StateChanged) => {
        if (typeof this.stateChangedCallback === 'function') {
            this.stateChangedCallback(
                this.mapConnectionState(payload.newState),
            );
        }
    };

    static isSupported() {
        return true;
    }

    setUnauthorizedCallback(callback: (url: string) => void) {
        this.unauthorizedCallback = callback;
    }

    setStateChangedCallback(callback: StateChangeCallback) {
        this.stateChangedCallback = callback;
    }

    setReceivedCallback(callback: ReceiveCallback) {
        this.connection.received(callback);
    }

    setConnectionSlowCallback(callback: () => void) {
        this.connection.connectionSlow(callback);
    }

    start(options: SignalR.ConnectionOptions, callback?: () => void) {
        this.connection.start(options, callback || NOOP);
    }

    stop() {
        this.connection.stop();
    }

    updateQuery(authToken: string, contextId: string) {
        this.connection.qs = `authorization=${encodeURIComponent(
            authToken,
        )}&context=${encodeURIComponent(contextId)}`;
    }

    getQuery() {
        return this.connection.qs as string;
    }

    getTransport() {
        // @ts-expect-error transport property missing in type definition
        return this.connection.transport;
    }
}

export default SignalrTransport;
