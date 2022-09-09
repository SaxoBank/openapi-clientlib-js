/**
 * Event that occurs when the connection state changes.
 */
export const EVENT_CONNECTION_STATE_CHANGED = 'connectionStateChanged' as const;
/**
 * Event that occurs when the connection is slow.
 */
export const EVENT_CONNECTION_SLOW = 'connectionSlow' as const;
/**
 * Event that occurs when the connection fails.
 */
export const EVENT_STREAMING_FAILED = 'streamingFailed' as const;
/**
 * Event that occurs when the _disconnect control message is received from server.
 */
export const EVENT_DISCONNECT_REQUESTED =
    'streamingDisconnectRequested' as const;

/**
 * Event that occurs when probe message is received.
 */
export const EVENT_PROBE_MESSAGE = 'probeMessage' as const;

/**
 * Streaming has been created but has not yet started the connection.
 */
export const CONNECTION_STATE_INITIALIZING = 0x1 as const;
/**
 * The connection has been started but may not yet be connecting.
 */
export const CONNECTION_STATE_STARTED = 0x2 as const;
/**
 * Connection is trying to connect. The previous state was CONNECTION_STATE_STARTED or CONNECTION_STATE_DISCONNECTED.
 */
export const CONNECTION_STATE_CONNECTING = 0x4 as const;
/**
 * Connection is connected and everything is good.
 */
export const CONNECTION_STATE_CONNECTED = 0x8 as const;
/**
 * Connection is reconnecting. The previous state was CONNECTION_STATE_CONNECTING.
 * We are current not connected, but might recover without having to reset.
 */
export const CONNECTION_STATE_RECONNECTING = 0x10 as const;
/**
 * Connection is disconnected. Streaming may attempt to connect again.
 */
export const CONNECTION_STATE_DISCONNECTED = 0x20 as const;

/**
 * Connection failed with no point of return. Indicates that next transport will be picked if possible.
 * No manual reconnect should be done at this point!
 */
export const CONNECTION_STATE_FAILED = 0x40 as const;

export const DATA_FORMAT_JSON = 0 as const;
export const DATA_FORMAT_PROTOBUF = 1 as const;

export const READABLE_CONNECTION_STATE_MAP = {
    [CONNECTION_STATE_INITIALIZING]: 'Initializing',
    [CONNECTION_STATE_STARTED]: 'Started',
    [CONNECTION_STATE_CONNECTING]: 'Connecting',
    [CONNECTION_STATE_CONNECTED]: 'Connected',
    [CONNECTION_STATE_RECONNECTING]: 'Reconnecting',
    [CONNECTION_STATE_DISCONNECTED]: 'Disconnected',
    [CONNECTION_STATE_FAILED]: 'Failed',
} as const;
