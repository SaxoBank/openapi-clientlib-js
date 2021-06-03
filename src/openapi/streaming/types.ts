import type ParserBase from './parser/parser-base';
import type { IHubProtocol } from '@microsoft/signalr';
import type {
    OPENAPI_CONTROL_MESSAGE_DISCONNECT,
    OPENAPI_CONTROL_MESSAGE_HEARTBEAT,
    OPENAPI_CONTROL_MESSAGE_RECONNECT,
    OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS,
} from './streaming';
import type { TRANSPORT_NAME_MAP } from './connection/connection';
import type * as connectionConstants from './connection/constants';
import type { StreamingData } from './connection/types';

export type TransportTypes = keyof typeof TRANSPORT_NAME_MAP;

export interface ConnectionOptions {
    waitForPageLoad?: boolean;
    transport?: Array<TransportTypes>;
    messageSerializationProtocol?: IHubProtocol;
    isWebsocketStreamingHeartBeatEnabled?: boolean;
}

export type ConnectionState =
    keyof typeof connectionConstants.READABLE_CONNECTION_STATE_MAP;

export type DataFormat =
    | typeof connectionConstants.DATA_FORMAT_JSON
    | typeof connectionConstants.DATA_FORMAT_PROTOBUF;

export interface Heartbeats {
    OriginatingReferenceId: string;
    Reason: string;
}

export interface StreamingMessage<T = unknown, R = string> {
    ReferenceId: R;
    Timestamp?: string;
    MessageId?: string | null;
    ReservedField?: number;
    DataFormat?: DataFormat;
    Data: T;
}

interface StreamingControlMessage<T = StreamingData, R = string>
    extends StreamingMessage<T, R> {
    Heartbeats?: Heartbeats[];
    TargetReferenceIds?: string[];
}

export type HeartbeatsControlMessage = StreamingControlMessage<
    {
        Heartbeats: Heartbeats[];
        ReferenceId: typeof OPENAPI_CONTROL_MESSAGE_HEARTBEAT;
    }[],
    typeof OPENAPI_CONTROL_MESSAGE_HEARTBEAT
>;

export type ResetControlMessage = StreamingControlMessage<
    {
        TargetReferenceIds: string[];
    }[],
    typeof OPENAPI_CONTROL_MESSAGE_RESET_SUBSCRIPTIONS
>;

type ConnectionControlMessage = StreamingControlMessage<
    any,
    | typeof OPENAPI_CONTROL_MESSAGE_RECONNECT
    | typeof OPENAPI_CONTROL_MESSAGE_DISCONNECT
>;

export type ControlMessage =
    | HeartbeatsControlMessage
    | ResetControlMessage
    | ConnectionControlMessage;

export interface RetryDelayLevel {
    level: number;
    delay: number;
}

export interface StreamingConfigurableOptions {
    /**
     * Whether the signal-r streaming connection waits for page load before starting
     */
    waitForPageLoad?: boolean;
    /**
     * The transports to be used in order by signal-r.
     */
    transportTypes?: Array<TransportTypes>;
    /**
     * The delay in milliseconds to wait before attempting a new connect after signal-r has disconnected
     */
    connectRetryDelay?: number;
    /**
     * The levels of delays in milliseconds for specific retry counts. Structure: `[{ level:Number, delay:Number }].`
     */
    connectRetryDelayLevels?: RetryDelayLevel[];
    /**
     * The map of subscription parsers where key is format name and value is parser constructor.
     */
    parsers?: Record<string, new (...args: any) => ParserBase>;
    /**
     * The map of subscription parser engines where key is format name and value is an engine implementation.
     */
    parserEngines?: Record<string, unknown>;
    transport?: Array<TransportTypes>;
    /**
     *  Message serialization protocol used by signalr core
     */
    messageProtocol?: Record<string, any>;
    messageSerializationProtocol?: IHubProtocol;
    /**
     * If true we wll get streaming heartbeat messages for websocket connection
     */
    isWebsocketStreamingHeartBeatEnabled?: boolean;
}
