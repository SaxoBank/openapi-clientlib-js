import log from '../../../../log';
import * as transportTypes from '../transportTypes';
import * as constants from '../constants';

const LOG_AREA = 'SignalrCoreTransport';
const NOOP = () => {};

// null at the end means stop trying and close the connection
const RECONNECT_DELAYS = [0, 2000, 3000, 5000, 10000, null];

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

function getRetryPolicy(transport) {
    return {
        nextRetryDelayInMilliseconds(retryContext) {
            if (transport.authExpiry < Date.now()) {
                log.warn(LOG_AREA, 'Token expired while trying to reconnect');

                // stop retrying and call close handler
                return null;
            }

            // If messages were not received before connection close, don't retry
            // instead create a new connection with different context id
            // Server relies on this to determine wheter its reconnection or not
            if (
                transport.lastMessageId === undefined ||
                transport.lastMessageId === null
            ) {
                return null;
            }

            return RECONNECT_DELAYS[retryContext.previousRetryCount];
        },
    };
}

function buildConnection({
    baseUrl,
    contextId,
    accessTokenFactory,
    protocol,
    retryPolicy,
    skipNegotiation,
    transportType,
}) {
    const url = `${baseUrl}/streaming?contextId=${contextId}`;
    let transport;
    if (transportType === transportTypes.SIGNALR_CORE_WEBSOCKETS) {
        transport = window.signalrCore.HttpTransportType.WebSockets;
    } else if (transportType === transportTypes.SIGNALR_CORE_LONG_POLLING) {
        transport = window.signalrCore.HttpTransportType.LongPolling;
    }

    return new window.signalrCore.HubConnectionBuilder()
        .withUrl(url, {
            accessTokenFactory,
            transport,
            skipNegotiation,
        })
        .withHubProtocol(protocol)
        .withAutomaticReconnect(retryPolicy)
        .configureLogging({
            log: handleLog,
        })
        .build();
}

function normalizeMessage(message, protocol) {
    const { ReferenceId, PayloadFormat, Payload, MessageId } = message;

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
        MessageId,
        DataFormat: dataFormat,
        Data: data,
    };
}

function parseMessage(message, utf8Decoder) {
    const { ReferenceId, DataFormat, MessageId } = message;
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
        MessageId,
        DataFormat,
        Data: data,
    };
}

function SignalrCoreTransport(baseUrl, transportFailCallback = NOOP) {
    this.name = transportTypes.SIGNALR_CORE;
    this.baseUrl = baseUrl;
    this.connection = null;
    this.authToken = null;
    this.authExpiry = null;
    this.contextId = null;
    this.messageStream = null;
    this.lastMessageId = null;
    this.hasStreamingStarted = false;
    this.isDisconnecting = false;
    this.hasTransportError = false;
    this.state = constants.CONNECTION_STATE_DISCONNECTED;

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
        typeof window.Uint8Array === 'function' &&
        typeof window.TextDecoder === 'function' &&
        // This check can be removed once signalr team resolves below issue
        // https://github.com/dotnet/aspnetcore/issues/29424
        (typeof fetch === 'undefined' ||
            typeof window.AbortController === 'function')
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

    let lastUsedToken = null;
    const protocol =
        options.messageSerializationProtocol ||
        new window.signalrCore.JsonHubProtocol();

    try {
        this.connection = buildConnection({
            baseUrl: this.baseUrl,
            contextId: this.contextId,
            accessTokenFactory: () => {
                lastUsedToken = this.authToken;
                return this.authToken;
            },
            protocol,
            retryPolicy: getRetryPolicy(this),
            skipNegotiation: options.skipNegotiation,
            transportType: options.transportType,
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

        this.setState(constants.CONNECTION_STATE_RECONNECTING);

        const baseUrl = this.connection.baseUrl.replace(/&messageId=\d+/, '');
        this.connection.baseUrl = `${baseUrl}&messageId=${this.lastMessageId}`;
    });
    this.connection.onreconnected(() => {
        // recreate message stream
        this.createMessageStream(protocol);
        this.setState(constants.CONNECTION_STATE_CONNECTED);

        // Token might have been updated while reconnect response was in flight
        if (lastUsedToken !== this.authToken) {
            this.renewSession();
        }
    });

    this.setState(constants.CONNECTION_STATE_CONNECTING);

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

            this.setState(constants.CONNECTION_STATE_CONNECTED);

            // Token might have been updated while reconnect response was in flight
            if (lastUsedToken !== this.authToken) {
                this.renewSession();
            }
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

    const sendCloseMessage = () =>
        this.connection.invoke('CloseConnection').catch((err) => {
            log.warn(
                LOG_AREA,
                'Error occurred while invoking CloseConnection',
                err,
            );
        });

    // close message stream before closing connection
    if (this.messageStream) {
        return this.messageStream
            .cancelCallback()
            .then(sendCloseMessage)
            .then(() => this.connection.stop());
    }

    return sendCloseMessage().then(() => this.connection.stop());
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
    // the transport explicitely sets this error flag when there is some issue while parsing message
    // or if unknown status is received during token renewal
    const shouldFallbackToOtherTransport = this.hasTransportError;

    this.connection = null;
    this.messageStream = null;
    this.lastMessageId = null;
    this.isDisconnecting = false;
    this.hasStreamingStarted = false;
    this.hasTransportError = false;

    if (shouldFallbackToOtherTransport) {
        this.transportFailCallback();
        return;
    }

    this.setState(constants.CONNECTION_STATE_DISCONNECTED);
};

SignalrCoreTransport.prototype.handleNextMessage = function(message, protocol) {
    if (!this.connection) {
        log.warn(
            LOG_AREA,
            'Message received after connection was closed',
            message,
        );
        return;
    }

    if (!this.hasStreamingStarted) {
        this.hasStreamingStarted = true;
    }

    try {
        const normalizedMessage = normalizeMessage(message, protocol);
        const data = parseMessage(normalizedMessage, this.utf8Decoder);

        this.lastMessageId = data.MessageId;
        this.receivedCallback(data);
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

        this.messageStream = null;
        this.stop();
    }
};

SignalrCoreTransport.prototype.updateQuery = function(
    authToken,
    contextId,
    authExpiry,
    forceAuth = false,
) {
    log.debug(LOG_AREA, 'Updated query', {
        contextId,
        forceAuth,
    });

    this.contextId = contextId;
    this.authExpiry = authExpiry;
    this.authToken = authToken.replace('BEARER ', '');

    if (forceAuth) {
        this.renewSession();
    }
};

SignalrCoreTransport.prototype.renewSession = function() {
    if (
        !this.connection ||
        this.state !== constants.CONNECTION_STATE_CONNECTED
    ) {
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
            }
        })
        .catch((error) => {
            // Invocation could get cancelled due to connection being closed
            if (
                !this.connection ||
                this.state !== constants.CONNECTION_STATE_CONNECTED
            ) {
                log.debug(
                    LOG_AREA,
                    'Token renewal failed. Either connection was closed or not connected',
                    {
                        state: this.state,
                    },
                );

                return;
            }

            log.warn(LOG_AREA, 'Failed to renew token', {
                error,
            });

            // Retry
            this.renewSession();
        });
};

SignalrCoreTransport.prototype.setState = function(state) {
    this.state = state;
    this.stateChangedCallback(state);
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
