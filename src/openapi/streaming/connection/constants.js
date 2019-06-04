/**
 * Event that occurs when the connection state changes.
 */
export const EVENT_CONNECTION_STATE_CHANGED = 'connectionStateChanged';
/**
 * Event that occurs when the connection is slow.
 */
export const EVENT_CONNECTION_SLOW = 'connectionSlow';

/**
 * Streaming has been created but has not yet started the connection.
 */
export const CONNECTION_STATE_INITIALIZING = 0x1;
/**
 * The connection has been started but may not yet be connecting.
 */
export const CONNECTION_STATE_STARTED = 0x2;
/**
 * Connection is trying to connect. The previous state was CONNECTION_STATE_STARTED or CONNECTION_STATE_DISCONNECTED.
 */
export const CONNECTION_STATE_CONNECTING = 0x4;
/**
 * Connection is connected and everything is good.
 */
export const CONNECTION_STATE_CONNECTED = 0x8;
/**
 * Connection is reconnecting. The previous state was CONNECTION_STATE_CONNECTING.
 * We are current not connected, but might recover without having to reset.
 */
export const CONNECTION_STATE_RECONNECTING = 0x10;
/**
 * Connection is disconnected. Streaming may attempt to connect again.
 */
export const CONNECTION_STATE_DISCONNECTED = 0x20;

/**
 * Connection failed with no point of return. Indicates that next transport will be picked if possible.
 * No manual reconnect should be done at this point!
 * @type {number}
 */
export const CONNECTION_STATE_FAILED = 0x40;

export const READABLE_CONNECTION_STATE_MAP = {
    [CONNECTION_STATE_INITIALIZING]: 'Initializing',
    [CONNECTION_STATE_STARTED]: 'Started',
    [CONNECTION_STATE_CONNECTING]: 'Connecting',
    [CONNECTION_STATE_CONNECTED]: 'Connected',
    [CONNECTION_STATE_RECONNECTING]: 'Reconnecting',
    [CONNECTION_STATE_DISCONNECTED]: 'Disconnected',
    [CONNECTION_STATE_FAILED]: 'Failed',
};
