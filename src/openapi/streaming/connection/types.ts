import type { TRANSPORT_NAME_MAP } from './connection';
import type { IHubProtocol } from '@microsoft/signalr';
import type { READABLE_CONNECTION_STATE_MAP } from './constants';

export type TransportTypes = keyof typeof TRANSPORT_NAME_MAP;

export interface ConnectionOptions {
    waitForPageLoad?: boolean;
    transport?: Array<TransportTypes>;
    messageSerializationProtocol?: IHubProtocol;
}

export type ConnectionState = keyof typeof READABLE_CONNECTION_STATE_MAP;

interface Callback {
    (): unknown;
}

export interface StreamingTransportOptions extends ConnectionOptions {
    transportType?: TransportTypes;
    skipNegotiation?: boolean;
}

export interface StreamingTransportInterface {
    stateChangedCallback: (state: ConnectionState) => void;

    start(transportOptions: StreamingTransportOptions, startCallback?: Callback): void;
    stop(hasTransportError?: boolean): void;
    name: string;

    getQuery?(): string | null | undefined | void;
    updateQuery(authToken: string, contextId: string, authExpiry?: number | null, forceAuth?: boolean): void;

    onOrphanFound?(): unknown;
    getTransport?(): StreamingTransportInterface;
    onSubscribeNetworkError?: () => void;
    setReceivedCallback(callback: Callback): void;
    setStateChangedCallback(callback: (state: ConnectionState) => void): void;
    setUnauthorizedCallback(callback: Callback): void;
    setConnectionSlowCallback(callback: Callback): void;
}
