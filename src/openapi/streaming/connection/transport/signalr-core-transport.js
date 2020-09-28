import fetch from '../../../../utils/fetch';
import log from '../../../../log';
import * as streamingTransports from '../../streamingTransports';
import * as constants from '../constants';

const LOG_AREA = 'SignalrCoreTransport';
const NOOP = () => {};

/**
 * Handles any signal-r log, and pipes it through our logging.
 * @param message
 */
function handleLog(level, message) {
    if (level < window.signalrCore.LogLevel.Error) {
        return;
    }

    log.error(LOG_AREA, message);
}

function buildConnection({ baseUrl, contextId, authToken, protocol }) {
    const accessTokenFactory = () => {
        return authToken.replace('BEARER ', '');
    };
    const url = `${baseUrl}/oapi/streaming?contextId=${contextId}`;

    return new window.signalrCore.HubConnectionBuilder()
        .withUrl(url, {
            accessTokenFactory,
        })
        .withHubProtocol(protocol)
        .configureLogging({
            log: handleLog,
        })
        .build();
}

function parseMessage(message, utf8Decoder) {
    let dataFormat;
    let data;

    const { referenceId, payloadFormat, payload } = message;

    // JSON
    if (payloadFormat === 1) {
        try {
            // use old streaming service's data format for backward compatibility
            dataFormat = 0;

            data = utf8Decoder.decode(new Uint8Array(payload));
            data = JSON.parse(data);
        } catch (e) {
            const error = new Error(e.message);
            error.payload = data;

            throw error;
        }
    } else {
        // Protobuf
        dataFormat = 1;
        data = new Uint8Array(payload);
    }

    return {
        ReferenceId: referenceId,
        DataFormat: dataFormat,
        Data: data,
    };
}

function SignalrCoreTransport(baseUrl, transportFailCallback = NOOP) {
    this.name = streamingTransports.SIGNALR_CORE;
    this.baseUrl = baseUrl;
    this.connection = null;
    this.authToken = null;
    this.contextId = null;
    this.messageStream = null;
    this.hasStreamingStarted = false;

    // callbacks
    this.transportFailCallback = transportFailCallback;
    this.stateChangedCallback = NOOP;
    this.receivedCallback = NOOP;
    this.errorCallback = NOOP;
    this.unauthorizedCallback = NOOP;

    try {
        this.utf8Decoder = new window.TextDecoder();
    } catch (error) {
        log.error(LOG_AREA, 'Error occured while initializing text decoder', {
            error,
        });

        transportFailCallback(error);
    }
}

SignalrCoreTransport.prototype.isSupported = function() {
    return Boolean(window.Uint8Array) && Boolean(window.TextDecoder);
};

SignalrCoreTransport.prototype.start = function(options, onStartCallback) {
    if (this.connection) {
        log.warn(
            LOG_AREA,
            'connection already exist, close the exisiting conection before starting new one',
        );
        return;
    }

    try {
        this.connection = buildConnection({
            baseUrl: this.baseUrl,
            contextId: this.contextId,
            authToken: this.authToken,
            protocol: options.protocol,
        });
    } catch (error) {
        this.transportFailCallback(error);
    }

    this.connection.onclose = this.handleConnectionClosure.bind(this);

    this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);

    return this.connection
        .start()
        .then(() => {
            const messageStream = this.connection.stream('StartStreaming');

            messageStream.subscribe({
                next: this.handleNextMessage.bind(this),
                error: this.handleMessageStreamError.bind(this),
            });

            if (onStartCallback) {
                onStartCallback();
            }

            this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            this.messageStream = messageStream;
        })
        .catch((error) => {
            this.transportFailCallback(error);
        });
};

SignalrCoreTransport.prototype.stop = function() {
    if (!this.connection) {
        log.warn(LOG_AREA, "connection doesn't exist");
        return;
    }

    // close message stream before closing connection
    return this.messageStream
        .cancelCallback()
        .then(() => this.connection.stop());
};

SignalrCoreTransport.prototype.handleConnectionClosure = function(error) {
    if (error) {
        log.error(LOG_AREA, 'connection closed abruptly', { error });
    }

    this.connection = null;

    if (!this.hasStreamingStarted) {
        this.transportFailCallback(error);
        return;
    }

    this.hasStreamingStarted = false;
    this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
};

SignalrCoreTransport.prototype.handleNextMessage = function(message) {
    if (!this.hasStreamingStarted) {
        this.hasStreamingStarted = true;
    }

    const parsedMessage = parseMessage(message, this.utf8Decoder);

    this.receivedCallback(parsedMessage);
};

SignalrCoreTransport.prototype.handleMessageStreamError = function(error) {
    // It will be called if signalr failed to send message to start streaming
    // or if connection is closed with some error
    // only handle the 1st case since connection closing with error is already handled in onclose handler
    if (!this.hasStreamingStarted) {
        log.error(LOG_AREA, 'Error occured while starting message streaming', {
            error,
        });

        this.connection.stop();
    }
};

SignalrCoreTransport.prototype.updateQuery = function(
    authToken,
    contextId,
    forceAuth = false,
) {
    log.debug(LOG_AREA, 'Updated query', {
        contextId,
        forceAuth,
    });

    this.contextId = contextId;
    this.authToken = authToken;

    if (forceAuth) {
        this.renewSession(authToken, contextId);
    }
};

SignalrCoreTransport.prototype.renewSession = function(authToken, contextId) {
    const options = {
        headers: {
            Authorization: authToken,
        },
    };
    const url = `${this.baseUrl}/oapi/streaming/renewal/renewsession`;

    return fetch('POST', url, options)
        .then(() => {
            log.debug(
                LOG_AREA,
                'Streaming session is successfully renewed with new token',
                {
                    contextId,
                },
            );
        })
        .catch((error) => {
            // if this call was superceded by another one, then ignore this error
            if (this.authToken !== authToken) {
                return;
            }

            // if a network error occurs, retry
            if (error && error.isNetworkError) {
                return this.renewSession(authToken, contextId);
            }

            if (error.status === 401) {
                this.unauthorizedCallback();
                return;
            }

            log.error(
                LOG_AREA,
                'Error occured during streaming session renewal',
                {
                    contextId,
                    error,
                },
            );

            this.transportFailCallback(error);
        });
};

SignalrCoreTransport.prototype.setStateChangedCallback = function(callback) {
    this.stateChangedCallback = callback;
};

SignalrCoreTransport.prototype.setReceivedCallback = function(callback) {
    this.receivedCallback = callback;
};

SignalrCoreTransport.prototype.setErrorCallback = function(callback) {
    this.errorCallback = callback;
};

SignalrCoreTransport.prototype.setUnauthorizedCallback = function(callback) {
    this.unauthorizedCallback = callback;
};

SignalrCoreTransport.prototype.setConnectionSlowCallback = NOOP;

export default SignalrCoreTransport;
