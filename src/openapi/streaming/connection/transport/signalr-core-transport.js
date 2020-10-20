import log from '../../../../log';
import * as transportTypes from '../transportTypes';
import * as constants from '../constants';

const LOG_AREA = 'SignalrCoreTransport';
const NOOP = () => {};
const RECONNECT_DELAYS = [2000, 3000, 5000, 10000, 20000];

const renewStatus = {
    SUCCESS: 0,
    INVALID_TOKEN: 1,
    SESSION_NOT_FOUND: 2,
};

/**
 * Handles any signal-r log, and pipes it through our logging.
 * @param message
 */
function handleLog(level, message) {
    if (level < window.signalrCore.LogLevel.Warning) {
        return;
    }

    log.warn(LOG_AREA, message);
}

function buildConnection({ baseUrl, contextId, accessTokenFactory, protocol }) {
    const url = `${baseUrl}/streaming?contextId=${contextId}`;

    return new window.signalrCore.HubConnectionBuilder()
        .withUrl(url, {
            accessTokenFactory,
        })
        .withHubProtocol(protocol)
        .withAutomaticReconnect(RECONNECT_DELAYS)
        .configureLogging({
            log: handleLog,
        })
        .build();
}

function normalizeMessage(message, protocol) {
    const { ReferenceId, PayloadFormat, Payload } = message;

    let dataFormat;
    // Normalize to old streaming format for backward compatibility
    if (PayloadFormat === 1) {
        dataFormat = constants.DATA_FORMAT_JSON;
    }

    // Normalize to old streaming format for backward compatibility
    if (PayloadFormat === 2) {
        dataFormat = constants.DATA_FORMAT_PROTOBUF;
    }

    let data = Payload;
    // JSON protocol converts bytes array to base64 encoded string
    // we need to convert it back to bytes
    if (protocol.name === 'json') {
        data = new Uint8Array(
            window
                .atob(data)
                .split('')
                .map((char) => char.charCodeAt(0)),
        );
    }

    return {
        ReferenceId,
        DataFormat: dataFormat,
        Data: data,
    };
}

function parseMessage(message, utf8Decoder) {
    const { ReferenceId, DataFormat } = message;
    let data = message.Data;

    if (DataFormat === constants.DATA_FORMAT_JSON) {
        try {
            data = utf8Decoder.decode(data);
            data = JSON.parse(data);
        } catch (error) {
            error.payload = data;

            throw error;
        }
    }

    return {
        ReferenceId,
        DataFormat,
        Data: data,
    };
}

function SignalrCoreTransport(baseUrl, transportFailCallback = NOOP) {
    this.name = transportTypes.SIGNALR_CORE;
    this.baseUrl = baseUrl;
    this.connection = null;
    this.authToken = null;
    this.contextId = null;
    this.messageStream = null;
    this.hasStreamingStarted = false;
    this.isDisconnecting = false;
    this.hasTransportError = false;
    this.isReconnecting = false;

    // callbacks
    this.transportFailCallback = transportFailCallback;
    this.stateChangedCallback = NOOP;
    this.receivedCallback = NOOP;
    this.errorCallback = NOOP;
    this.unauthorizedCallback = NOOP;

    try {
        this.utf8Decoder = new window.TextDecoder();
    } catch (error) {
        log.error(LOG_AREA, 'Error occurred while initializing text decoder', {
            error,
        });

        transportFailCallback();
    }
}

SignalrCoreTransport.isSupported = function() {
    return (
        window.signalrCore &&
        typeof window.signalrCore.HubConnectionBuilder === 'function' &&
        Boolean(window.Uint8Array) &&
        Boolean(window.TextDecoder)
    );
};

SignalrCoreTransport.prototype.start = function(options, onStartCallback) {
    if (this.connection) {
        log.warn(
            LOG_AREA,
            'connection already exist, close the exisiting conection before starting new one',
        );
        return;
    }

    const protocol =
        options.messageSerializationProtocol ||
        new window.signalrCore.JsonHubProtocol();

    try {
        this.connection = buildConnection({
            baseUrl: this.baseUrl,
            contextId: this.contextId,
            accessTokenFactory: () => {
                return this.authToken;
            },
            protocol,
        });
    } catch (error) {
        log.error(LOG_AREA, "Couldn't intialize the connection", {
            error,
        });

        this.transportFailCallback();
        return;
    }

    this.connection.onclose((error) => this.handleConnectionClosure(error));
    this.connection.onreconnecting((error) => {
        log.debug(LOG_AREA, 'Attempting to reconnect', {
            error,
        });

        this.isReconnecting = true;
        this.stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);
    });
    this.connection.onreconnected(() => {
        this.isReconnecting = false;
        // recreate message stream
        this.createMessageStream(protocol);
        this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
    });

    this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);

    return this.connection
        .start()
        .then(() => {
            if (this.isDisconnecting) {
                return;
            }

            this.createMessageStream(protocol);

            if (onStartCallback) {
                onStartCallback();
            }

            this.stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
        })
        .catch((error) => {
            log.error(
                LOG_AREA,
                'Error occurred while connecting to streaming service',
                {
                    error,
                },
            );

            this.transportFailCallback();
        });
};

SignalrCoreTransport.prototype.stop = function(hasTransportError) {
    if (!this.connection) {
        log.warn(LOG_AREA, "connection doesn't exist");
        return;
    }

    this.isDisconnecting = true;
    if (hasTransportError) {
        this.hasTransportError = true;
    }

    // close message stream before closing connection
    if (this.messageStream) {
        return this.messageStream
            .cancelCallback()
            .then(() => this.connection.stop());
    }

    return this.connection.stop();
};

SignalrCoreTransport.prototype.createMessageStream = function(protocol) {
    if (!this.connection) {
        log.warn(
            LOG_AREA,
            'Trying to create message stream before creating connection',
        );
        return;
    }

    const messageStream = this.connection.stream('StartStreaming');
    messageStream.subscribe({
        next: (message) => this.handleNextMessage(message, protocol),
        error: (error) => this.handleMessageStreamError(error),
        complete: () => {
            log.info(
                LOG_AREA,
                'Message stream closed gracefully. Closing connection',
            );

            this.messageStream = null;
            this.stop();
        },
    });

    this.messageStream = messageStream;
};

SignalrCoreTransport.prototype.handleConnectionClosure = function(error) {
    if (error) {
        log.error(LOG_AREA, 'connection closed abruptly', { error });
    }

    // Do not trigger disconnect in case of transport fallback to avoid reconnection
    const shouldTriggerDisconnect = !this.hasTransportError;

    this.connection = null;
    this.messageStream = null;
    this.isDisconnecting = false;
    this.hasStreamingStarted = false;
    this.hasTransportError = false;

    if (shouldTriggerDisconnect) {
        this.stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
    }
};

SignalrCoreTransport.prototype.handleNextMessage = function(message, protocol) {
    if (!this.hasStreamingStarted) {
        this.hasStreamingStarted = true;
    }

    try {
        const normalizedMessage = normalizeMessage(message, protocol);
        const parsedMessage = parseMessage(normalizedMessage, this.utf8Decoder);

        this.receivedCallback(parsedMessage);
    } catch (error) {
        const errorMessage = error.message || '';
        log.error(
            LOG_AREA,
            `Error occurred while parsing message. ${errorMessage}`,
            {
                error,
                payload: error.payload,
                protocol: protocol.name,
            },
        );

        this.stop(true);
        this.transportFailCallback();
    }
};

SignalrCoreTransport.prototype.handleMessageStreamError = function(error) {
    // It will be called if signalr failed to send message to start streaming
    // or if connection is closed with some error
    // only handle the 1st case since connection closing with error is already handled in onclose handler
    // It will trigger disconnected state and will eventually try to reconnect again
    if (!this.hasStreamingStarted) {
        log.error(LOG_AREA, 'Error occurred while starting message streaming', {
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
    this.authToken = authToken.replace('BEARER ', '');

    if (forceAuth) {
        this.renewSession();
    }
};

SignalrCoreTransport.prototype.renewSession = function() {
    if (!this.connection || this.isReconnecting) {
        return;
    }

    const authToken = this.authToken;
    const contextId = this.contextId;

    return this.connection
        .invoke('RenewToken', authToken)
        .then(({ Status }) => {
            switch (Status) {
                case renewStatus.SUCCESS:
                    log.info(
                        LOG_AREA,
                        'Successfully renewed token for session',
                        {
                            contextId,
                        },
                    );
                    return;

                case renewStatus.INVALID_TOKEN:
                    // if this call was superseded by another one, then ignore this error
                    // else let auth provider know of invalid token
                    if (this.authToken === authToken) {
                        this.unauthorizedCallback();
                    }

                    return;

                case renewStatus.SESSION_NOT_FOUND:
                    log.warn(
                        LOG_AREA,
                        'Session not found while renewing session',
                        {
                            contextId,
                        },
                    );

                    // should try to reconnect with different context id
                    this.stop();
                    return;

                default:
                    log.error(
                        LOG_AREA,
                        'Unknown status received while renewing session',
                        {
                            status: Status,
                            contextId,
                        },
                    );

                    this.stop(true);
                    this.transportFailCallback();
            }
        })
        .catch((error) => {
            // Invocation could get cancelled due to connection being closed
            if (!this.connection || this.isReconnecting) {
                return;
            }

            log.warn(
                LOG_AREA,
                'Failed to renew token possibly due to network issues',
                {
                    error,
                },
            );

            // Retry
            this.renewSession();
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
