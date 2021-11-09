/**
 * Simple unidirectional (receive) WebSocket transport.
 * Follows WebSocket behaviour defined by spec:
 * https://html.spec.whatwg.org/multipage/web-sockets.html
 *
 * Supports simple reconnect mechanism in scenarios when webSocket will be closed.
 */
import * as constants from '../constants';
import log from '../../../../log';
import * as uint64utils from '../../../../utils/uint64';
import fetch from '../../../../utils/fetch';
import { getRequestId } from '../../../../utils/request';
import * as transportTypes from '../transportTypes';
import type {
    DataFormat,
    StreamingMessage,
    ConnectionOptions,
} from '../../types';
import type {
    StreamingTransportInterface,
    StateChangeCallback,
    ReceiveCallback,
} from '../types';
import {
    OPENAPI_CONTROL_MESSAGE_DISCONNECT,
    OPENAPI_CONTROL_MESSAGE_RECONNECT,
    OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS,
    OPENAPI_CONTROL_MESSAGE_CONNECTION_HEARTBEAT,
} from '../../control-messages';

const LOG_AREA = 'PlainWebSocketsTransport';

interface CustomError extends Error {
    payload?: any;
    payloadSize?: number;
}

const socketCloseCodes = {
    NORMAL_CLOSURE: 1000,
    TOKEN_EXPIRED: 1002,
};

const CLOSE_REASON_DESTROY = 'Normal Close due to connection destroy action';

const DEFAULT_RECONNECT_DELAY = 2000;
const DEFAULT_RECONNECT_LIMIT = 10;
const MAX_INACTIVITY_WAIT_TIME = 3000;

const STATE_NONE = 0;
const STATE_AWAITING_START = 1;
const STATE_CONNECTING = 2;
const STATE_CONNECTED = 3;
const STATE_AWAITING_RECONNECT = 4;

type WS_STATE =
    | typeof STATE_NONE
    | typeof STATE_AWAITING_START
    | typeof STATE_CONNECTING
    | typeof STATE_CONNECTED
    | typeof STATE_AWAITING_RECONNECT;

const NOOP = () => {};

/**
 * Simple unidirectional (receive) WebSocket transport.
 * Follows WebSocket behaviour defined by spec:
 * https://html.spec.whatwg.org/multipage/web-sockets.html
 *
 * Supports simple reconnect mechanism in scenarios when webSocket will be closed.
 *
 * @param baseUrl - The base url.
 * @param restTransport - The Rest Transport.
 * @param failCallback - The Fail callback. If invoked, indicates that something went
 *          critically wrong and this transport cannot be used anymore.
 */
class WebsocketTransport implements StreamingTransportInterface {
    name = transportTypes.PLAIN_WEBSOCKETS;

    // WebSocket instance
    socket: WebSocket | null = null;

    // Urls
    connectionUrl = '';
    authorizeUrl = '';

    // If true, indicates that transport had at least once successful connection (received onopen).
    hasBeenConnected = false;

    lastMessageId: null | number = null;
    reconnectTimeout: number | null = null;
    reconnectCount = 0;
    lastOrphanFound = 0;
    lastSubscribeNetworkError = 0;
    lastMessageTime = 0;
    query: string | null = null;
    contextId: string | null = null;
    isAuthorized = false;
    authToken: string | null = null;
    // Callbacks
    failCallback;
    stateChangedCallback: StateChangeCallback = NOOP;
    receivedCallback: ReceiveCallback = NOOP;
    connectionSlowCallback = NOOP;
    startedCallback = NOOP;
    unauthorizedCallback: (url: string) => void = NOOP;
    utf8Decoder!: TextDecoder;
    inactivityFinderRunning: boolean;
    inactivityFinderNextUpdateTimeoutId: number | null = null;

    state: WS_STATE = STATE_NONE;

    constructor(
        baseUrl: string,
        failCallback: (data?: { message: string }) => void = NOOP,
    ) {
        // Urls
        this.connectionUrl = `${baseUrl}/streamingws/connect`;
        this.authorizeUrl = `${baseUrl}/streamingws/authorize`;

        this.failCallback = failCallback;
        this.inactivityFinderRunning = false;

        try {
            this.utf8Decoder = new window.TextDecoder();
        } catch (e) {
            failCallback({
                message: `Error occurred while initializing text decoder : ${e.message}`,
            });
        }
    }

    static isSupported() {
        return (
            Boolean(window.WebSocket) &&
            Boolean(window.Int8Array) &&
            Boolean(window.Uint8Array) &&
            Boolean(window.TextDecoder)
        );
    }

    private normalizeWebSocketUrl(url: string) {
        return url.replace('http://', 'ws://').replace('https://', 'wss://');
    }

    private handleSocketOpen = () => {
        if (this.socket) {
            this.hasBeenConnected = true;
            this.state = STATE_CONNECTED;
            this.reconnectCount = 0;

            log.debug(LOG_AREA, 'Socket opened');
            this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            this.startInactivityFinder();
        }
    };

    private parseMessage(rawData: ArrayBuffer) {
        let index = 0;
        const messages: StreamingMessage[] = [];

        while (index < rawData.byteLength) {
            const message = new DataView(rawData);

            // First 8 bytes make up the message id. A 64 bit integer.
            const messageIdBuffer = new Uint8Array(rawData, index, 8);
            index += 8;
            // 2 bytes make up the reserved field.This field is reserved for future use and it should be ignored by the client.
            const reservedField = message.getInt16(index);
            index += 2;
            // 1 byte makes up the reference id length as an 8 bit integer. The reference id has a max length og 50 chars.
            const referenceIdSize = message.getInt8(index);
            index += 1;
            // n bytes make up the reference id. The reference id is an ASCII string.
            const referenceIdBuffer = new Int8Array(
                rawData,
                index,
                referenceIdSize,
            );
            const referenceId = String.fromCharCode(...referenceIdBuffer);
            index += referenceIdSize;
            // 1 byte makes up the payload format. The value 0 indicates that the payload format is Json.
            const dataFormat = message.getUint8(index);
            index++;
            // 4 bytes make up the payload length as a 32 bit integer.
            const payloadSize = message.getUint32(index, true);
            index += 4;
            // n bytes make up the actual payload. In the case of the payload format being Json, this is a UTF8 encoded string.
            let data;

            if (dataFormat === constants.DATA_FORMAT_JSON) {
                try {
                    const payload = new Uint8Array(rawData, index, payloadSize);
                    data = this.utf8Decoder.decode(payload);
                    data = JSON.parse(data);
                } catch (e) {
                    const error: CustomError = new Error(e.message);
                    error.payload = data;
                    error.payloadSize = payloadSize;

                    throw error;
                }
            } else {
                // Protobuf
                data = new Uint8Array(rawData, index, payloadSize);
            }

            const messageId = uint64utils.uint64ToNumber(messageIdBuffer);
            const firstReferenceId = data[0]?.ReferenceId;

            // _connectionheartbeat control message don't have message id
            if (
                firstReferenceId !==
                OPENAPI_CONTROL_MESSAGE_CONNECTION_HEARTBEAT
            ) {
                if (
                    this.lastMessageId &&
                    messageId !== this.lastMessageId + 1
                ) {
                    if (
                        messageId === 1 &&
                        ((firstReferenceId ===
                            OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS &&
                            !data[0].TargetReferenceIds?.length) ||
                            firstReferenceId ===
                                OPENAPI_CONTROL_MESSAGE_RECONNECT ||
                            firstReferenceId ===
                                OPENAPI_CONTROL_MESSAGE_DISCONNECT)
                    ) {
                        log.info(LOG_AREA, 'Message id reset to 1', {
                            messageId,
                            lastMessageId: this.lastMessageId,
                        });
                    } else {
                        log.error(
                            LOG_AREA,
                            'Messages out of order in websocket transport',
                            {
                                messageId,
                                lastMessageId: this.lastMessageId,
                            },
                        );
                    }
                }

                this.lastMessageId = messageId;
            }

            index += payloadSize;

            messages.push({
                ReservedField: reservedField,
                ReferenceId: referenceId,
                DataFormat: dataFormat as DataFormat,
                Data: data,
            });
        }

        return messages;
    }

    private handleSocketMessage = (messageEvent: MessageEvent<ArrayBuffer>) => {
        this.lastMessageTime = Date.now();

        if (messageEvent.data instanceof ArrayBuffer) {
            let parsedMessages;
            try {
                parsedMessages = this.parseMessage(messageEvent.data);
            } catch (error) {
                log.error(
                    LOG_AREA,
                    'Error occurred during parsing of plain WebSocket message',
                    {
                        error,
                        payload: error.payload,
                        payloadSize: error.payloadSize,
                    },
                );

                // fallback to next transport
                this.handleFailure();
                return;
            }

            this.receivedCallback(parsedMessages);
        } else {
            log.error(LOG_AREA, 'Received a non-ArrayBuffer message', {
                payload: messageEvent.data,
            });
        }
    };

    private handleSocketClose = (event: {
        code: number;
        reason: string;
        wasClean: boolean;
    }) => {
        if (!this.socket) {
            return;
        }

        this.state = STATE_NONE;

        if (!this.hasBeenConnected) {
            log.warn(LOG_AREA, 'websocket error occurred.', {
                readyState: this.socket.readyState,
                code: event.code,
                reason: event.reason,
            });
            this.handleFailure();

            return;
        }

        const isCleanDisconnect = event.wasClean === true;
        if (!isCleanDisconnect) {
            log.info(LOG_AREA, 'Websocket connection closed abruptly', {
                readyState: this.socket.readyState,
                code: event.code,
                reason: event.reason,
            });
        } else {
            log.debug(LOG_AREA, 'Websocket connection closed');
        }

        if (event.code === socketCloseCodes.TOKEN_EXPIRED) {
            this.unauthorizedCallback(this.connectionUrl);

            this.state = STATE_AWAITING_RECONNECT;
            return;
        }

        this.reconnect(
            // if this is the first time, try immediately to prevent delay
            this.reconnectCount === 0,
        );
    };

    private createSocket() {
        try {
            this.state = STATE_CONNECTING;
            const url = this.normalizeWebSocketUrl(
                `${this.connectionUrl}${this.query}`,
            );

            log.debug(LOG_AREA, 'Creating WebSocket connection', { url });
            const socket = new WebSocket(url);

            socket.binaryType = 'arraybuffer';
            socket.onopen = this.handleSocketOpen;
            socket.onmessage = this.handleSocketMessage;
            socket.onclose = this.handleSocketClose;

            this.socket = socket;
        } catch (error) {
            log.error(LOG_AREA, 'Failed to setup webSocket connection', error);
            this.handleFailure();
        }
    }

    private reconnect(isImmediate?: boolean) {
        if (this.reconnectCount >= DEFAULT_RECONNECT_LIMIT) {
            this.stop();
            return;
        }

        if (this.reconnectTimeout && !isImmediate) {
            log.warn(LOG_AREA, 'Reconnecting when already reconnecting');
        }

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = null;
        this.stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);

        this.destroySocket();

        // need to update the last message id
        this.updateQuery(this.authToken as string, this.contextId as string);

        if (isImmediate) {
            this.restartConnection();
            return;
        }

        this.reconnectTimeout = window.setTimeout(
            this.restartConnection,
            DEFAULT_RECONNECT_DELAY,
        );
    }

    private restartConnection = () => {
        this.reconnectTimeout = null;
        this.reconnectCount++;

        this.createSocket();

        log.debug(LOG_AREA, 'Transport reconnected');
    };

    private destroySocket() {
        const socket = this.socket;
        this.socket = null;

        if (!socket) {
            return;
        }

        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close(socketCloseCodes.NORMAL_CLOSURE, CLOSE_REASON_DESTROY);
        this.stopInactivityFinder();
    }

    /**
     * Handle transport failure.
     */
    private handleFailure() {
        this.destroySocket();
        this.stateChangedCallback(constants.CONNECTION_STATE_FAILED);
        this.failCallback();
    }

    private detectNetworkError() {
        const fiveSecondsAgo = Date.now() - 1000 * 5;

        // if we haven't got a message recently
        // but we found a orphan recently
        // and got a network error subscribing
        // and our reconnectCount is 0 so we are not currently reconnecting
        if (
            this.lastMessageTime < fiveSecondsAgo &&
            this.lastOrphanFound > fiveSecondsAgo &&
            this.lastSubscribeNetworkError > fiveSecondsAgo &&
            this.reconnectCount === 0
        ) {
            log.info(
                LOG_AREA,
                'Detected a broken websocket, so attempting to reconnect',
                {
                    readyState: this.socket?.readyState,
                },
            );

            // reconnect immediately as no need to wait - this is the initial event
            this.reconnect(true);
        }
    }

    private startInactivityFinder = () => {
        if (this.inactivityFinderRunning) {
            log.warn(
                LOG_AREA,
                'Starting inactivityFinder when already started',
            );
            return;
        }
        this.inactivityFinderRunning = true;
        this.inactivityFinderNextUpdateTimeoutId = window.setTimeout(
            this.onInactivityFinderUpdate,
            MAX_INACTIVITY_WAIT_TIME,
        );
    };

    private stopInactivityFinder = () => {
        if (this.inactivityFinderNextUpdateTimeoutId) {
            clearTimeout(this.inactivityFinderNextUpdateTimeoutId);
            this.inactivityFinderNextUpdateTimeoutId = null;
        }
        this.inactivityFinderRunning = false;
    };

    private onInactivityFinderUpdate = () => {
        if (!this.inactivityFinderRunning) {
            return;
        }

        const now = Date.now();
        if (
            this.state === STATE_CONNECTED &&
            this.lastMessageTime &&
            now - this.lastMessageTime >= MAX_INACTIVITY_WAIT_TIME
        ) {
            // no message on tranport since MAX_INACTIVITY_WAIT_TIME duration so reconnect
            log.info(
                LOG_AREA,
                'Inactivity finder reconnecting since no message recieved since 3 seconds',
            );
            this.reconnect();
        }

        this.inactivityFinderNextUpdateTimeoutId = window.setTimeout(
            this.onInactivityFinderUpdate,
            MAX_INACTIVITY_WAIT_TIME,
        );
    };

    isSupported = WebsocketTransport.isSupported;

    setUnauthorizedCallback(callback: (url: string) => void) {
        this.unauthorizedCallback = callback;
    }

    setStateChangedCallback(callback: StateChangeCallback) {
        this.stateChangedCallback = callback;
    }

    setReceivedCallback(callback: ReceiveCallback) {
        this.receivedCallback = callback;
    }

    setConnectionSlowCallback(callback: () => void) {
        this.connectionSlowCallback = callback;
    }

    authorizeConnection(
        contextId: string | null,
        authToken: string | null,
        forceAuthenticate?: boolean,
    ) {
        if (!forceAuthenticate && this.isAuthorized) {
            log.debug(LOG_AREA, 'Connection already authorized');
            this.onAuthorized();
            return;
        }

        this.isAuthorized = false;

        if (!authToken) {
            const errorMessage = 'Authorization token is not provided';
            log.error(LOG_AREA, errorMessage, {
                contextId,
            });

            return;
        }

        const options: { headers?: Record<string, string> } = {
            headers: {
                'X-Request-Id': getRequestId().toString(),
                Authorization: authToken,
            },
        };
        const url = `${this.authorizeUrl}?contextId=${contextId}`;

        fetch('put', url, options).then(
            () => {
                log.debug(LOG_AREA, 'Authorization completed', {
                    contextId,
                });
                // if this call was superseded by another one, then ignore this
                if (
                    this.authToken !== authToken ||
                    this.contextId !== contextId
                ) {
                    return;
                }
                this.isAuthorized = true;
                this.onAuthorized();
            },
            (error) => {
                // if this call was superseded by another one, then ignore this error
                if (
                    this.authToken !== authToken ||
                    this.contextId !== contextId
                ) {
                    return;
                }

                // if a network error occurs, retry after 300ms
                if (error?.isNetworkError) {
                    setTimeout(() => {
                        // if this call was superseded by another one, then ignore this error
                        if (
                            this.authToken !== authToken ||
                            this.contextId !== contextId
                        ) {
                            return;
                        }
                        this.authorizeConnection(contextId, authToken, true);
                    }, 300);
                    return;
                }

                log.warn(LOG_AREA, 'Authorization failed', error);
                this.handleFailure();
            },
        );
    }

    start(_options?: ConnectionOptions, callback?: () => void) {
        this.startedCallback = callback || NOOP;
        if (!this.isSupported()) {
            log.error(LOG_AREA, 'WebSocket Transport is not supported');

            this.handleFailure();
            return;
        }

        if (this.socket) {
            log.warn(LOG_AREA, 'Only one socket per connection is allowed');
            return;
        }

        log.debug(LOG_AREA, 'Starting transport');

        this.state = STATE_AWAITING_START;

        this.authorizeConnection(this.contextId, this.authToken);
    }

    onAuthorized() {
        switch (this.state) {
            case STATE_NONE:
                break;

            case STATE_AWAITING_START:
                this.onAuthorizedAwaitingStart();
                break;

            case STATE_AWAITING_RECONNECT:
                this.onAuthorizedAwaitingReconnect();
                break;

            default:
                log.error(LOG_AREA, 'Unexpected state onAuthorized', {
                    state: this.state,
                });
                break;
        }
    }

    onAuthorizedAwaitingStart() {
        this.startedCallback();
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
        this.createSocket();
    }

    onAuthorizedAwaitingReconnect() {
        this.reconnect(true);
    }

    stop() {
        this.destroySocket();

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        this.reconnectTimeout = null;
        this.contextId = null;
        this.lastMessageId = null;
        this.isAuthorized = false;
        this.reconnectCount = 0;
        this.hasBeenConnected = false;
        this.lastOrphanFound = 0;
        this.lastSubscribeNetworkError = 0;
        this.state = STATE_NONE;

        this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
    }

    onOrphanFound() {
        this.lastOrphanFound = Date.now();
        this.detectNetworkError();
    }

    onSubscribeNetworkError() {
        this.lastSubscribeNetworkError = Date.now();
        this.detectNetworkError();
    }

    updateQuery(
        authToken: string,
        contextId: string,
        _authExpiry?: number,
        forceAuth = false,
    ) {
        if (contextId !== this.contextId) {
            this.lastMessageId = null;
            forceAuth = true;
        }
        // sendHeartbeats=true server sends _connectionheartbeat after 2 seconds of inactivity on a streaming connection
        let query = `?contextId=${encodeURIComponent(
            contextId,
        )}&Authorization=${encodeURIComponent(authToken)}&sendHeartbeats=true`;

        if (this.lastMessageId != null) {
            query += `&messageid=${this.lastMessageId}`;
        }

        log.debug(LOG_AREA, 'Updated query', {
            query,
            contextId,
            lastMessageId: this.lastMessageId,
        });

        this.query = query;
        this.contextId = contextId;
        this.authToken = authToken;

        if (forceAuth && this.state !== STATE_NONE) {
            this.authorizeConnection(this.contextId, authToken, true);
        }
    }

    getQuery() {
        return this.query;
    }
}

export default WebsocketTransport;
