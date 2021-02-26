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

const LOG_AREA = 'PlainWebSocketsTransport';

const socketCloseCodes = {
    NORMAL_CLOSURE: 1000,
    TOKEN_EXPIRED: 1002,
};

const CLOSE_REASON_DESTROY = 'Normal Close due to connection destroy action';

const DEFAULT_RECONNECT_DELAY = 2000;
const DEFAULT_RECONNECT_LIMIT = 10;

const NOOP = () => {};

// -- Local methods section --

function normalizeWebSocketUrl(url) {
    return url.replace('http://', 'ws://').replace('https://', 'wss://');
}

function createSocket() {
    try {
        const url = normalizeWebSocketUrl.call(
            this,
            `${this.connectionUrl}${this.query}`,
        );

        log.debug(LOG_AREA, 'Creating WebSocket connection', { url });
        const socket = new WebSocket(url);

        socket.binaryType = 'arraybuffer';
        socket.onopen = handleSocketOpen.bind(this);
        socket.onmessage = handleSocketMessage.bind(this);
        socket.onclose = handleSocketClose.bind(this);

        this.socket = socket;
    } catch (error) {
        log.error(LOG_AREA, 'Failed to setup webSocket connection', error);
        handleFailure.call(this);
    }
}

function destroySocket() {
    const socket = this.socket;
    this.socket = null;

    if (!socket) {
        return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close(socketCloseCodes.NORMAL_CLOSURE, CLOSE_REASON_DESTROY);
}

function restartConnection() {
    this.reconnectTimeout = null;
    this.reconnectCount++;

    createSocket.call(this);

    log.debug(LOG_AREA, 'Transport reconnected');
}

function reconnect(isImmediate) {
    if (this.reconnectCount >= DEFAULT_RECONNECT_LIMIT) {
        this.stop();
        return;
    }

    if (this.reconnectTimeout && !isImmediate) {
        log.warn(LOG_AREA, 'Reconnecting when already reconnecting');
    }

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);

    destroySocket.call(this);

    if (isImmediate) {
        restartConnection.call(this);
        return;
    }

    this.reconnectTimeout = setTimeout(
        restartConnection.bind(this),
        DEFAULT_RECONNECT_DELAY,
    );
}

function parseMessage(rawData) {
    let index = 0;
    const messages = [];

    while (index < rawData.byteLength) {
        const message = new DataView(rawData);

        // First 8 bytes make up the message id. A 64 bit integer.
        const messageId = new Uint8Array(rawData, index, 8);
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
        const referenceId = String.fromCharCode.apply(
            String,
            referenceIdBuffer,
        );
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
                const error = new Error(e.message);
                error.payload = data;
                error.payloadSize = payloadSize;

                throw error;
            }
        } else {
            // Protobuf
            data = new Uint8Array(rawData, index, payloadSize);
        }

        this.lastMessageId = messageId;

        index += payloadSize;

        messages.push({
            ReservedField: reservedField,
            ReferenceId: referenceId,
            DataFormat: dataFormat,
            Data: data,
        });
    }

    return messages;
}

/**
 * Handle transport failure.
 */
function handleFailure() {
    destroySocket.call(this);
    this.stateChangedCallback(constants.CONNECTION_STATE_FAILED);
    this.failCallback();
}

function handleSocketOpen() {
    if (this.socket) {
        this.hasBeenConnected = true;
        this.reconnectCount = 0;

        log.debug(LOG_AREA, 'Socket opened');
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
    }
}

function handleSocketMessage(messageEvent) {
    this.lastMessageTime = Date.now();

    if (messageEvent.data instanceof ArrayBuffer) {
        let parsedMessages;
        try {
            parsedMessages = parseMessage.call(this, messageEvent.data);
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
            handleFailure.call(this);
            return;
        }

        this.receivedCallback(parsedMessages);
    } else {
        log.error(LOG_AREA, 'Received a non-ArrayBuffer message', {
            payload: messageEvent.data,
        });
    }
}

function handleSocketClose(event) {
    if (!this.socket) {
        return;
    }

    if (!this.hasBeenConnected) {
        log.info(LOG_AREA, 'websocket error occurred.', {
            readyState: this.socket.readyState,
            code: event.code,
            reason: event.reason,
        });
        handleFailure.call(this);

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
        this.unauthorizedCallback();

        // reconnect once we authorise with the new token
        this.isReconnectPending = true;
        return;
    }

    reconnect.call(
        this,
        // if this is the first time, try immediately to prevent delay
        this.reconnectCount === 0,
    );
}

function detectNetworkError() {
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
                readyState: this.socket.readyState,
            },
        );

        // reconnect immediately as no need to wait - this is the initial event
        reconnect.call(this, true);
    }
}

// -- Exported methods section --

/**
 * Simple unidirectional (receive) WebSocket transport.
 * Follows WebSocket behaviour defined by spec:
 * https://html.spec.whatwg.org/multipage/web-sockets.html
 *
 * Supports simple reconnect mechanism in scenarios when webSocket will be closed.
 *
 * @param {string} baseUrl - The base url.
 * @param {Object} restTransport - The Rest Transport.
 * @param {function} failCallback - The Fail callback. If invoked, indicates that something went
 *          critically wrong and this transport cannot be used anymore.
 *
 * @constructor
 */
function WebsocketTransport(baseUrl, failCallback = NOOP) {
    this.name = transportTypes.PLAIN_WEBSOCKETS;

    // WebSocket instance
    this.socket = null;

    // Urls
    this.connectionUrl = `${baseUrl}/streamingws/connect`;
    this.authorizeUrl = `${baseUrl}/streamingws/authorize`;

    // If true, indicates that transport had at least once successful connection (received onopen).
    this.hasBeenConnected = false;

    // If socket closes due to unauthorised token, we wait for authorisation with new token before reconnecting
    this.isReconnectPending = false;

    this.lastMessageId = null;
    this.reconnectTimeout = null;
    this.reconnectCount = 0;

    this.lastOrphanFound = 0;
    this.lastSubscribeNetworkError = 0;
    this.lastMessageTime = 0;

    this.query = null;
    this.contextId = null;
    this.authorizePromise = null;
    this.authToken = null;

    // Callbacks
    this.failCallback = failCallback;
    this.logCallback = NOOP;
    this.stateChangedCallback = NOOP;
    this.receivedCallback = NOOP;
    this.connectionSlowCallback = NOOP;
    this.startedCallback = NOOP;
    this.closeCallback = NOOP;
    this.unauthorizedCallback = NOOP;

    try {
        this.utf8Decoder = new window.TextDecoder();
    } catch (e) {
        failCallback({
            message: `Error occurred while initializing text decoder : ${e.message}`,
        });
    }
}

WebsocketTransport.isSupported = function() {
    return (
        Boolean(window.WebSocket) &&
        Boolean(window.Int8Array) &&
        Boolean(window.Uint8Array) &&
        Boolean(window.TextDecoder)
    );
};

WebsocketTransport.prototype.isSupported = WebsocketTransport.isSupported;

WebsocketTransport.prototype.setUnauthorizedCallback = function(callback) {
    this.unauthorizedCallback = callback;
};

WebsocketTransport.prototype.setStateChangedCallback = function(callback) {
    this.stateChangedCallback = callback;
};

WebsocketTransport.prototype.setReceivedCallback = function(callback) {
    this.receivedCallback = callback;
};

WebsocketTransport.prototype.setConnectionSlowCallback = function(callback) {
    this.connectionSlowCallback = callback;
};

WebsocketTransport.prototype.getAuthorizePromise = function(
    contextId,
    authToken,
    forceAuthenticate,
) {
    if (!forceAuthenticate && this.authorizePromise) {
        log.debug(LOG_AREA, 'Connection already authorized');
        return this.authorizePromise;
    }

    if (!authToken) {
        const errorMessage = 'Authorization token is not provided';
        log.error(LOG_AREA, errorMessage, {
            contextId,
        });

        return Promise.reject(new Error(errorMessage));
    }

    const options = {
        headers: {
            'X-Request-Id': getRequestId(),
            Authorization: authToken,
        },
    };
    const url = `${this.authorizeUrl}?contextId=${contextId}`;

    this.authorizePromise = fetch('PUT', url, options)
        .then((response) => {
            log.debug(LOG_AREA, 'Authorization completed', {
                contextId,
            });
            return response;
        })
        .catch((error) => {
            // if this call was superseded by another one, then ignore this error
            if (this.authToken !== authToken || this.contextId !== contextId) {
                return Promise.reject();
            }

            // if a network error occurs, retry
            if (error && error.isNetworkError) {
                return this.getAuthorizePromise(contextId, authToken, true);
            }

            log.error(LOG_AREA, 'Authorization failed', error);
            handleFailure.call(this);
            throw error;
        });

    return this.authorizePromise;
};

WebsocketTransport.prototype.start = function(options, callback) {
    this.startedCallback = callback || NOOP;

    if (!this.isSupported()) {
        handleFailure.call(this, {
            message: 'WebSocket Transport is not supported.',
        });
        return;
    }

    if (this.socket) {
        log.warn(LOG_AREA, 'Only one socket per connection is allowed');
        return;
    }

    log.debug(LOG_AREA, 'Starting transport');

    const authorizePromise = this.getAuthorizePromise(
        this.contextId,
        this.authToken,
    );

    authorizePromise.then(
        () => {
            this.startedCallback();
            this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            createSocket.call(this);
        },
        () => {
            // we handle everything in authorizePromise, this just stops an unhandled rejection
        },
    );
};

WebsocketTransport.prototype.stop = function() {
    destroySocket.call(this);

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.contextId = null;
    this.lastMessageId = null;
    this.authorizePromise = null;
    this.reconnectCount = 0;
    this.hasBeenConnected = false;
    this.lastOrphanFound = 0;
    this.lastSubscribeNetworkError = 0;

    this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
};

WebsocketTransport.prototype.onOrphanFound = function() {
    this.lastOrphanFound = Date.now();
    detectNetworkError.call(this);
};

WebsocketTransport.prototype.onSubscribeNetworkError = function() {
    this.lastSubscribeNetworkError = Date.now();
    detectNetworkError.call(this);
};

WebsocketTransport.prototype.updateQuery = function(
    authToken,
    contextId,
    forceAuth = false,
) {
    let query = `?contextId=${encodeURIComponent(
        contextId,
    )}&Authorization=${encodeURIComponent(authToken)}`;
    let lastMessageIdString;

    if (this.lastMessageId !== null && this.lastMessageId !== undefined) {
        lastMessageIdString = uint64utils.uint64ToStringLE(this.lastMessageId);
        query += `&messageid=${lastMessageIdString}`;
    }

    log.debug(LOG_AREA, 'Updated query', {
        query,
        contextId,
        lastMessageId: lastMessageIdString,
    });

    this.query = query;
    this.contextId = contextId;
    this.authToken = authToken;

    if (forceAuth) {
        const authorizePromise = this.getAuthorizePromise(
            this.contextId,
            authToken,
            true,
        );

        if (this.isReconnectPending) {
            authorizePromise.then(() => {
                this.isReconnectPending = false;
                reconnect.call(this, true);
            });
        }
    }
};

WebsocketTransport.prototype.getQuery = function() {
    return this.query;
};

export default WebsocketTransport;
