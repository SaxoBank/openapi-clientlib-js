import log from '../../../../log';
import * as transportTypes from '../transportTypes';
import * as constants from '../constants';
import type {
    ConnectionState,
    TransportTypes,
    StreamingMessage,
} from '../../types';
import type {
    StreamingTransportOptions,
    StreamingTransportInterface,
    StreamingData,
    StateChangeCallback,
    ReceiveCallback,
} from '../types';
import type SignalR from '@microsoft/signalr';
import {
    OPENAPI_CONTROL_MESSAGE_DISCONNECT,
    OPENAPI_CONTROL_MESSAGE_RECONNECT,
    OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS,
} from '../../control-messages';

declare global {
    interface Window {
        signalrCore: typeof SignalR;
    }
}

type RawCoreSignalRStreamingMessage = {
    ReferenceId: string;
    PayloadFormat: 1 | 2;
    Payload: StreamingData;
    MessageId: number;
};

const LOG_AREA = 'SignalrCoreTransport';
const NOOP = () => {};

// null at the end means stop trying and close the connection
const RECONNECT_DELAYS = [0, 2000, 3000, 5000, 10000, null];

const renewStatus = {
    SUCCESS: 0,
    INVALID_TOKEN: 1,
    SESSION_NOT_FOUND: 2,
};

class SignalrCoreTransport implements StreamingTransportInterface {
    baseUrl = '';
    name = transportTypes.SIGNALR_CORE;
    connection: SignalR.HubConnection | null = null;
    authToken: string | null = null;
    authExpiry: number | null = null;
    contextId: string | null = null;
    messageStream: SignalR.IStreamResult<any> | null = null;
    lastMessageId: number | null = null;
    hasStreamingStarted = false;
    isDisconnecting = false;
    hasTransportError = false;
    state: ConnectionState = constants.CONNECTION_STATE_DISCONNECTED;

    stateChangedCallback: StateChangeCallback = NOOP;
    receivedCallback: ReceiveCallback = NOOP;
    unauthorizedCallback = NOOP;
    setConnectionSlowCallback = NOOP;
    transportFailCallback;

    utf8Decoder!: TextDecoder;

    constructor(baseUrl: string, transportFailCallback = NOOP) {
        this.baseUrl = baseUrl;
        // callbacks
        this.transportFailCallback = transportFailCallback;

        try {
            this.utf8Decoder = new window.TextDecoder();
        } catch (error) {
            log.error(
                LOG_AREA,
                'Error occurred while initializing text decoder',
                {
                    error,
                },
            );

            transportFailCallback();
        }
    }

    static isSupported = function () {
        return (
            window.signalrCore &&
            typeof window.signalrCore.HubConnectionBuilder === 'function' &&
            typeof window.Uint8Array === 'function' &&
            typeof window.TextDecoder === 'function' &&
            (typeof fetch === 'undefined' ||
                typeof window.AbortController === 'function')
        );
    };

    /**
     * Handles any signal-r log, and pipes it through our logging.
     * @param message - message
     */
    private handleLog = (level: number, message: string) => {
        if (level < window.signalrCore.LogLevel.Warning) {
            return;
        }

        log.warn(LOG_AREA, message);
    };

    private getRetryPolicy = (
        authExpiry: number,
        lastMessageId: number | null,
    ) => {
        return {
            nextRetryDelayInMilliseconds(retryContext: SignalR.RetryContext) {
                if (authExpiry < Date.now()) {
                    log.warn(
                        LOG_AREA,
                        'Token expired while trying to reconnect',
                    );

                    // stop retrying and call close handler
                    return null;
                }

                // If messages were not received before connection close, don't retry
                // instead create a new connection with different context id
                // Server relies on this to determine whether its reconnection or not
                if (lastMessageId === undefined || lastMessageId === null) {
                    return null;
                }

                return RECONNECT_DELAYS[retryContext.previousRetryCount];
            },
        };
    };

    private buildConnection = (parameters: {
        baseUrl: string;
        contextId: string;
        accessTokenFactory: () => string;
        protocol: SignalR.IHubProtocol;
        retryPolicy: SignalR.IRetryPolicy;
        skipNegotiation?: boolean;
        transportType?: TransportTypes;
    }) => {
        const {
            baseUrl,
            contextId,
            accessTokenFactory,
            protocol,
            retryPolicy,
            skipNegotiation,
            transportType,
        } = parameters;

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
                log: this.handleLog,
            })
            .build();
    };

    private normalizeMessage = (
        message: RawCoreSignalRStreamingMessage,
        protocol: SignalR.IHubProtocol,
    ): StreamingMessage => {
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
                    .atob(data as string)
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
    };

    private parseMessage(
        message: StreamingMessage,
        utf8Decoder: TextDecoder,
    ): StreamingMessage {
        const { ReferenceId, DataFormat, MessageId } = message;
        let data = message.Data;

        if (message.DataFormat === constants.DATA_FORMAT_JSON) {
            try {
                data = JSON.parse(
                    utf8Decoder.decode(message.Data as BufferSource),
                );
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

    start(options: StreamingTransportOptions, onStartCallback?: () => void) {
        if (this.connection) {
            log.warn(
                LOG_AREA,
                'connection already exist, close the existing connection before starting new one',
            );
            return;
        }

        let lastUsedToken: string | null = null;
        const protocol: SignalR.IHubProtocol =
            options.messageSerializationProtocol ||
            new window.signalrCore.JsonHubProtocol();

        try {
            this.connection = this.buildConnection({
                baseUrl: this.baseUrl,
                contextId: this.contextId as string, // assuming contextId already exists
                accessTokenFactory: () => {
                    lastUsedToken = this.authToken;
                    return this.authToken as string; // assuming authToken already exists
                },
                protocol,
                retryPolicy: this.getRetryPolicy(
                    this.authExpiry as number, // assuming authExpiry already exists
                    this.lastMessageId,
                ),
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

        this.connection.onclose((error?: Error) =>
            this.handleConnectionClosure(error),
        );
        this.connection.onreconnecting((error) => {
            log.debug(LOG_AREA, 'Attempting to reconnect', {
                error,
            });

            this.setState(constants.CONNECTION_STATE_RECONNECTING);

            const baseUrl = (
                this.connection as SignalR.HubConnection
            ).baseUrl.replace(/&messageId=\d+/, '');
            (
                this.connection as SignalR.HubConnection
            ).baseUrl = `${baseUrl}&messageId=${this.lastMessageId}`;
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
    }

    stop(hasTransportError?: boolean) {
        if (!this.connection) {
            log.warn(LOG_AREA, "connection doesn't exist");
            return;
        }

        this.isDisconnecting = true;
        if (hasTransportError) {
            this.hasTransportError = true;
        }

        const sendCloseMessage = () =>
            this.connection
                ? this.connection.invoke('CloseConnection').catch((err) => {
                      log.info(
                          LOG_AREA,
                          'Error occurred while invoking CloseConnection',
                          err,
                      );
                  })
                : Promise.resolve();

        // close message stream before closing connection
        if (this.messageStream) {
            return (
                this.messageStream
                    // @ts-expect-error cancelCallback is no included in the IStreamResult but according to implementation it exists
                    .cancelCallback()
                    .then(sendCloseMessage)
                    .then(() => this.connection && this.connection.stop())
            );
        }

        return sendCloseMessage().then(
            () => this.connection && this.connection.stop(),
        );
    }

    createMessageStream(protocol: SignalR.IHubProtocol) {
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
    }

    isNetworkError(error: Error | undefined) {
        return error?.message?.match(
            /WebSocket closed with status code: (1006|1011)|Server timeout elapsed without receiving a message|Failed to fetch|Not found|Network request failed|Invocation canceled due to the underlying connection being closed/,
        );
    }

    handleConnectionClosure(error?: Error) {
        if (error) {
            log.warn(LOG_AREA, 'connection closed abruptly', {
                error,
                isNetworkError: this.isNetworkError(error),
            });
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
    }

    handleNextMessage(
        message: RawCoreSignalRStreamingMessage,
        protocol: SignalR.IHubProtocol,
    ) {
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
            const normalizedMessage = this.normalizeMessage(message, protocol);
            const data = this.parseMessage(normalizedMessage, this.utf8Decoder);

            if (
                this.lastMessageId &&
                data.MessageId !== this.lastMessageId + 1
            ) {
                if (
                    data.MessageId === 0 &&
                    ((data.ReferenceId ===
                        OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS &&
                        !data.TargetReferenceIds?.length) ||
                        data.ReferenceId ===
                            OPENAPI_CONTROL_MESSAGE_RECONNECT ||
                        data.ReferenceId === OPENAPI_CONTROL_MESSAGE_DISCONNECT)
                ) {
                    log.info(LOG_AREA, 'Message id reset to 0', {
                        lastMessageId: this.lastMessageId,
                        messageId: data.MessageId,
                    });
                } else {
                    log.error(
                        LOG_AREA,
                        'Missing a streaming signalr-core message',
                        {
                            lastMessageId: this.lastMessageId,
                            messageId: data.MessageId,
                        },
                    );
                }
            }

            this.lastMessageId = data.MessageId as number;
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
    }

    handleMessageStreamError(error: Error | undefined) {
        // It will be called if signalr failed to send message to start streaming
        // or if connection is closed with some error
        // only handle the 1st case since connection closing with error is already handled in onclose handler
        // It will trigger disconnected state and will eventually try to reconnect again
        if (!this.hasStreamingStarted) {
            log.warn(
                LOG_AREA,
                'Error occurred while starting message streaming',
                {
                    error,
                    isNetworkError: this.isNetworkError(error),
                },
            );

            this.messageStream = null;
            this.stop();
        }
    }

    updateQuery(
        authToken: string,
        contextId: string,
        authExpiry: number,
        forceAuth = false,
    ) {
        log.debug(LOG_AREA, 'Updated query', {
            contextId,
            forceAuth,
        });

        if (contextId !== this.contextId) {
            this.lastMessageId = null;
        }

        this.contextId = contextId;
        this.authExpiry = authExpiry;
        this.authToken = authToken.replace(/bearer\s/i, '');

        if (forceAuth) {
            this.renewSession();
        }
    }

    renewSession() {
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
    }

    setState(state: ConnectionState) {
        this.state = state;
        this.stateChangedCallback(state);
    }

    setStateChangedCallback(callback: StateChangeCallback) {
        this.stateChangedCallback = callback;
    }

    setReceivedCallback(callback: ReceiveCallback) {
        this.receivedCallback = callback;
    }

    setUnauthorizedCallback(callback: () => void) {
        this.unauthorizedCallback = callback;
    }
}

export default SignalrCoreTransport;
