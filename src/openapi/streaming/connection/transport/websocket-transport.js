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
import SignalrTransport from './signalr-transport';

const LOG_AREA = 'PlainWebSocketsTransport';

const NAME = 'plainWebSockets';

// Internal webSocket readyState possible values.
// eslint-disable-next-line no-unused-vars
const STATE_INTERNAL_CONNECTING = 0;
const STATE_INTERNAL_OPEN = 1;
const STATE_INTERNAL_CLOSING = 2;
const STATE_INTERNAL_CLOSED = 3;

const DEFAULT_RECONNECT_DELAY = 2000;
const DEFAULT_RECONNECT_LIMIT = 10;

const NOOP = () => {};

// Normal closure; the connection successfully completed whatever purpose for which it was created.
// Ref. https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
const CLOSE_STATUS_CODE = 1000;
const CLOSE_REASON_DESTROY = 'Normal Close due to connection destroy action';

// -- Local methods section --

function normalizeWebSocketUrl(url) {
    return url.replace('http://', 'ws://').replace('https://', 'wss://');
}

function getWebSocketUrl() {
    return normalizeWebSocketUrl.call(this, `${this.connectionUrl}${this.query}`);
}

function destroySocket(socket) {
    if (!socket) {
        return;
    }
    socket.onopen = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close(CLOSE_STATUS_CODE, CLOSE_REASON_DESTROY);
}

function reconnect() {
    if (this.reconnectCount >= DEFAULT_RECONNECT_LIMIT) {
        handleFailure.call(this, { message: 'Transport reached maximum amount of reconnects allowed till last successful connection.' });
        return;
    }

    clearTimeout(this.reconnectTimeout);
    this.stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
        this.reconnectCount++;

        this.stop();
        this.start();
        log.debug(LOG_AREA, 'Transport reconnected');
    }, DEFAULT_RECONNECT_DELAY);
}

function configure() {
    try {
        this.socket.binaryType = 'arraybuffer';
        this.socket.onopen = handleSocketOpen.bind(this);
        this.socket.onerror = handleSocketError.bind(this);
        this.socket.onmessage = handleSocketMessage.bind(this);
        this.socket.onclose = handleSocketClose.bind(this);
    } catch (error) {
        handleFailure.call(this, { message: 'Failed to setup webSocket connection' });
    }
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
        const referenceIdBuffer = new Int8Array(rawData.slice(index, index + referenceIdSize));
        const referenceId = String.fromCharCode.apply(String, referenceIdBuffer);
        index += referenceIdSize;
        // 1 byte makes up the payload format. The value 0 indicates that the payload format is Json.
        const dataFormat = message.getUint8(index);
        index++;
        // 4 bytes make up the payload length as a 32 bit integer.
        const payloadSize = message.getUint32(index, true);
        index += 4;
        // n bytes make up the actual payload. In the case of the payload format being Json, this is a UTF8 encoded string.
        let data;

        if (dataFormat === 0) {
            const payloadBuffer = new Uint8Array(rawData.slice(index, index + payloadSize));
            data = String.fromCharCode.apply(null, payloadBuffer);
            data = decodeURIComponent(escape(data));
            data = JSON.parse(data);
        } else {
            // Protobuf
            data = new Uint8Array(rawData.slice(index, index + payloadSize));
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
 * @param { Object } error - The error object with message property.
 */
function handleFailure(error) {
    this.stateChangedCallback(constants.CONNECTION_STATE_FAILED);
    this.destroy();
    this.failCallback(error);
}

function handleSocketMessage(messageEvent) {
    if (messageEvent.data instanceof ArrayBuffer) {
        let parsedMessages;
        try {
            parsedMessages = parseMessage.call(this, messageEvent.data);
        } catch (e) {
            handleFailure.call(this, { message: `Error occurred during parsing of plain WebSocket message. Message: ${e.message}` });
            return;
        }

        log.debug('Parsed message', {
            messages: parsedMessages,
        });

        this.receivedCallback(parsedMessages);
    }
}

function handleSocketClose(event) {
    if (this.socket && this.socket.readyState === STATE_INTERNAL_CLOSED || this.socket.readyState === STATE_INTERNAL_CLOSING) {
        log.debug(LOG_AREA, 'Transport connection closed', {
            readyState: this.socket.readyState,
            code: event.code,
        });

        // Order here is important. We need to invoke state callback first, as parent streaming manager updates query upon disconnect.
        this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
        reconnect.call(this);
    }
}

function handleSocketOpen() {
    if (this.socket && this.socket.readyState === STATE_INTERNAL_OPEN) {
        this.hasWorked = true;
        this.reconnectCount = 0;

        log.debug(LOG_AREA, 'Socket opened');
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
    }
}

function handleSocketError(error) {
    if (this.socket) {
        log.error(LOG_AREA, 'Socket error occurred', {
            code: error.code,
            reason: error.reason,
        });

        if (this.hasWorked) {
            // If transport worked at least once, try to reconnect when error occurs instead of failing.
            this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
            reconnect.call(this);
        } else {
            handleFailure.call(this, { message: `WebSocket connection failed with error code: ${error.code}, reason: ${error.reason}` });
        }
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
function WebsocketTransport(baseUrl, restTransport, failCallback = NOOP) {
    this.name = NAME;

    // WebSocket instance
    this.socket = null;

    // Urls
    this.baseUrl = baseUrl;
    this.connectionUrl = `${baseUrl}/streamingws/connect`;
    this.authorizeUrl = 'authorize';
    this.authorizeServiceGroup = 'streamingws';

    // If true, indicates that transport had at least once successful connection (received onopen).
    this.hasWorked = false;

    this.lastMessageId = null;
    this.reconnectTimeout = null;
    this.reconnectCount = 0;

    this.query = null;
    this.restTransport = restTransport;
    this.contextId = null;
    this.authorizePromise = null;
    this.isAuthorized = false;

    // Callbacks
    this.failCallback = failCallback;
    this.logCallback = NOOP;
    this.stateChangedCallback = NOOP;
    this.receivedCallback = NOOP;
    this.errorCallback = NOOP;
    this.connectionSlowCallback = NOOP;
    this.startedCallback = NOOP;
    this.closeCallback = NOOP;
    this.unauthorizedCallback = NOOP;
}

WebsocketTransport.NAME = NAME;

WebsocketTransport.isSupported = function() {
    return (
        Boolean(window.WebSocket) &&
        Boolean(window.Int8Array) &&
        Boolean(window.Uint8Array)
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

/**
 * The error callback. If invoked, indicates some error occurred.
 * @param callback
 */
WebsocketTransport.prototype.setErrorCallback = function(callback) {
    this.errorCallback = callback;
};

/**
 *
 * Suggested next step is a fallback to another transport if possible.
 * @param callback
 */
WebsocketTransport.prototype.fail = function(callback) {
    this.failCallback = callback;
};

WebsocketTransport.prototype.setConnectionSlowCallback = function(callback) {
    this.connectionSlowCallback = callback;
};

WebsocketTransport.prototype.getAuthorizePromise = function(contextId) {
    if (this.isAuthorized) {
        log.debug(LOG_AREA, 'Connection already authorized');
        return Promise.resolve();
    }

    const thisTokenAuthExpiry = this.authExpiry;
    return new Promise((resolve, reject) => {
        this.restTransport.put(this.authorizeServiceGroup, `${this.authorizeUrl}?contextId=${contextId}`)
            .then((response) => {
                log.debug(LOG_AREA, 'Authorization completed', {
                    contextId,
                });
                this.isAuthorized = true;
                resolve(response);
            })
            .catch((error) => {
                if (error && error.status === 401) {
                    this.unauthorizedCallback(thisTokenAuthExpiry);
                }
                log.error(LOG_AREA, 'Authorization failed', {
                    contextId,
                    error,
                });
                reject(error);
                handleFailure.call(this, error);
            });
    });
};

WebsocketTransport.prototype.start = function(options, callback) {
    this.startedCallback = callback || NOOP;

    if (!this.isSupported()) {
        handleFailure({ message: 'WebSocket Transport is not supported.' });
        return;
    }

    this.authorizePromise = this.getAuthorizePromise(this.contextId);

    const url = getWebSocketUrl.call(this);

    log.debug(LOG_AREA, 'Starting transport', { url });

    if (this.socket) {
        // To make sure one socket connection per transport exists, destroy previous one if it exists.
        destroySocket(this.socket);
        this.socket = null;
    }

    this.authorizePromise.then(() => {
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
        log.debug(LOG_AREA, 'Creating WebSocket connection', { url });
        this.socket = new WebSocket(url);
        configure.call(this);
        this.startedCallback();
    });
};

WebsocketTransport.prototype.stop = function() {
    if (this.socket) {
        this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
        this.destroy();
        log.debug(LOG_AREA, 'Transport stopped');
    }
};

WebsocketTransport.prototype.updateQuery = function(authToken, contextId, authExpiry, forceAuth = false) {
    let query = `?contextId=${encodeURIComponent(contextId)}&Authorization=${encodeURIComponent(authToken)}`;
    let lastMessageIdString;

    this.authExpiry = authExpiry;

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

    if (forceAuth) {
        this.isAuthorized = false;
        this.authorizePromise = this.getAuthorizePromise(this.contextId);
    }
};

WebsocketTransport.prototype.getQuery = function() {
    return this.query;
};

WebsocketTransport.prototype.destroy = function() {
    clearInterval(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.isAuthorized = false;
    this.contextId = null;
    this.lastMessageId = null;
    this.reconnectCount = 0;

    destroySocket(this.socket);
    this.socket = null;
};

export default WebsocketTransport;
