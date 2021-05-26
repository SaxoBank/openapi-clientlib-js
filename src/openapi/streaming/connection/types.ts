import type {
    ConnectionOptions,
    ConnectionState,
    StreamingMessage,
    TransportTypes,
} from '../types';

export interface ReceiveCallback {
    (data: StreamingMessage | StreamingMessage[]): void;
}

export interface StateChangeCallback {
    (nextState: ConnectionState | null): void;
}

export interface StreamingTransportOptions extends ConnectionOptions {
    transportType?: TransportTypes;
    skipNegotiation?: boolean;
}

export interface StreamingTransportInterface {
    stateChangedCallback: (state: ConnectionState) => void;

    start(
        transportOptions: StreamingTransportOptions,
        startCallback?: () => void,
    ): void;
    stop(hasTransportError?: boolean): void;
    name: string;

    getQuery?(): string | null | undefined | void;
    updateQuery(
        authToken: string,
        contextId: string,
        authExpiry?: number | null,
        forceAuth?: boolean,
    ): void;

    onOrphanFound?(): unknown;

    getTransport?(): StreamingTransportInterface;

    onSubscribeNetworkError?: () => void;

    setReceivedCallback(callback: ReceiveCallback): void;

    setStateChangedCallback(callback: StateChangeCallback): void;

    setUnauthorizedCallback(callback: () => void): void;

    setConnectionSlowCallback(callback: () => void): void;
}

export type StreamingData =
    | Array<unknown>
    | Record<string, unknown>
    | BufferSource
    | string;
