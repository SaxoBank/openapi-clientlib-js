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

const LOG_AREA = 'PlainWebSocketsTransport';

const NAME = 'plainWebSockets';

const socketCloseCodes = {
    NORMAL_CLOSURE: 1000,
    TOKEN_EXPIRED: 1002,
}

const CLOSE_REASON_DESTROY = 'Normal Close due to connection destroy action';

const DEFAULT_RECONNECT_DELAY = 2000;
const DEFAULT_RECONNECT_LIMIT = 10;

const NOOP = () => {};

// -- Local methods section --

function normalizeWebSocketUrl(url) {
    return url.replace('http://', 'ws://').replace('https://', 'wss://');
}

function connect() {
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
        handleFailure.call(this, {
            message: 'Failed to setup webSocket connection',
        });
    }
}

function disconnect() {
    const socket = this.socket;
    if (!socket) {
        return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.close(socketCloseCodes.NORMAL_CLOSURE, CLOSE_REASON_DESTROY);

    this.socket = null;
}

function reconnect() {
    if (this.reconnectCount >= DEFAULT_RECONNECT_LIMIT) {
        this.stop();
        return;
    }

    clearTimeout(this.reconnectTimeout);
    this.stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
        this.reconnectCount++;

        disconnect.call(this);
        connect.call(this);

        log.debug(LOG_AREA, 'Transport reconnected');
    }, DEFAULT_RECONNECT_DELAY);
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
            rawData.slice(index, index + referenceIdSize),
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

        if (dataFormat === 0) {
            const payloadBuffer = new Uint8Array(
                rawData.slice(index, index + payloadSize),
            );
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

function handleSocketOpen() {
    if (this.socket) {
        this.hasWorked = true;
        this.reconnectCount = 0;

        log.debug(LOG_AREA, 'Socket opened');
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
        this.startedCallback();
    }
}

function handleSocketMessage(messageEvent) {
    if (messageEvent.data instanceof ArrayBuffer) {
        let parsedMessages;
        try {
            parsedMessages = parseMessage.call(this, messageEvent.data);
        } catch (e) {
            handleFailure.call(this, {
                message: `Error occurred during parsing of plain WebSocket message. Message: ${e.message}`,
            });
            return;
        }

        log.debug('Parsed message', {
            messages: parsedMessages,
        });

        this.receivedCallback(parsedMessages);
    }
}

function handleSocketClose(event) {
    if (!this.socket) {
        return;
    }

    if (!this.hasWorked) {
        handleFailure({
            message: `websocket error occured. code: ${event.code}, reason: ${event.reason}`,
        });

        return;
    }

    const isCleanDisconnect = event.wasClean === true;
    if (!isCleanDisconnect) {
        log.error(LOG_AREA, 'websocket connection closed abruptly', {
            readyState: this.socket.readyState,
            code: event.code,
            reason: event.reason,
        });
    } else {
        log.debug(LOG_AREA, 'websocket connection closed');
    }

    if (event.code === socketCloseCodes.TOKEN_EXPIRED) {
        this.unauthorizedCallback();
    }

    reconnect.call(this);
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

WebsocketTransport.prototype.setConnectionSlowCallback = function(callback) {
    this.connectionSlowCallback = callback;
};

WebsocketTransport.prototype.getAuthorizePromise = function(
    contextId,
    forceAuthenticate,
) {
    if (!forceAuthenticate && this.authorizePromise) {
        log.debug(LOG_AREA, 'Connection already authorized');
        return this.authorizePromise;
    }

    this.authorizePromise = new Promise((resolve, reject) => {
        this.restTransport
            .put(
                this.authorizeServiceGroup,
                `${this.authorizeUrl}?contextId=${contextId}`,
            )
            .then((response) => {
                log.debug(LOG_AREA, 'Authorization completed', {
                    contextId,
                });
                resolve(response);
            })
            .catch((error) => {
                log.error(LOG_AREA, 'Authorization failed', {
                    contextId,
                    error,
                });
                reject(error);
                handleFailure.call(this, error);
            });
    });

    return this.authorizePromise;
};

WebsocketTransport.prototype.start = function(options, callback) {
    this.startedCallback = callback || NOOP;

    if (!this.isSupported()) {
        handleFailure({ message: 'WebSocket Transport is not supported.' });
        return;
    }

    if (this.socket) {
        log.debug(LOG_AREA, 'only one socket per connection is allowed');
        return;
    }
    

    log.debug(LOG_AREA, 'Starting transport');

    const authorizePromise = this.getAuthorizePromise(this.contextId);

    authorizePromise.then(() => {
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
        
        connect.call(this);
    });
};

WebsocketTransport.prototype.stop = function() {
    disconnect.call(this);

    clearInterval(this.reconnectTimeout);
    this.reconnectTimeout = null;
    this.contextId = null;
    this.lastMessageId = null;
    this.authorizePromis = null;
    this.reconnectCount = 0;
    this.hasWorked = false;
    
    this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
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

    if (forceAuth) {
        this.getAuthorizePromise(this.contextId, true);
    }
};

WebsocketTransport.prototype.getQuery = function() {
    return this.query;
};

export default WebsocketTransport;
