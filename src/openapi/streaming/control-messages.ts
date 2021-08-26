export const OPENAPI_CONTROL_MESSAGE_PREFIX = '_';
export const OPENAPI_CONTROL_MESSAGE_HEARTBEAT = '_heartbeat';
export const OPENAPI_CONTROL_MESSAGE_CONNECTION_HEARTBEAT =
    '_connectionheartbeat';
export const OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS =
    '_resetsubscriptions';
export const OPENAPI_CONTROL_MESSAGE_RECONNECT = '_reconnect';
export const OPENAPI_CONTROL_MESSAGE_DISCONNECT = '_disconnect';

/**
 * A control message for analysing network performance.
 * Allows the server to send "probe" messages to the streaming connection with a payload for measurements etc.
 */
export const OPENAPI_CONTROL_MESSAGE_PROBE = '_probe';
