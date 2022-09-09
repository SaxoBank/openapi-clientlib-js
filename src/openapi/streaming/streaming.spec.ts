import {
    installClock,
    uninstallClock,
    tick,
    setTimeout,
    getResolvablePromise,
} from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import mockMathRandom from '../../test/mocks/math-random';
import log from '../../log';
import mockAuthProvider from '../../test/mocks/authProvider';
import mockFetch from '../../test/mocks/fetch';
import Streaming, { findRetryDelay } from './streaming';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import Subscription from './subscription';
import type { SubscriptionState } from './subscription';
import type { RetryDelayLevel, StreamingConfigurableOptions } from './types';
import * as connectionConstants from './connection/constants';
import * as streamingTransports from './connection/transportTypes';
import 'fast-text-encoding';
import { HubConnectionState } from '@microsoft/signalr';

describe('openapi Streaming', () => {
    let stateChangedCallback: (arg: Record<string, any>) => void;
    let connectionSlowCallback: () => void;
    let startCallback: () => void;
    let receivedCallback: (arg: null | Record<string, any>[]) => void;
    let errorCallback: (arg: string) => void;
    let authProvider: any;
    let mockConnection: {
        stateChanged: jest.Mock;
        start: jest.Mock;
        received: jest.Mock;
        error: jest.Mock;
        connectionSlow: jest.Mock;
        stop: jest.Mock;
    };

    let transport: any;
    let fetchMock: ReturnType<typeof mockFetch>;

    const legacySignalrConnectionState = {
        connecting: 0,
        connected: 1,
        reconnecting: 2,
        disconnected: 4,
    };

    beforeEach(() => {
        mockConnection = {
            stateChanged: jest.fn(),
            start: jest.fn(),
            received: jest.fn(),
            error: jest.fn(),
            connectionSlow: jest.fn(),
            stop: jest.fn(),
        };
        mockConnection.stateChanged.mockImplementation((callback) => {
            stateChangedCallback = callback;
        });
        mockConnection.start.mockImplementation((_, callback) => {
            startCallback = callback;
        });
        mockConnection.received.mockImplementation((callback) => {
            receivedCallback = callback;
        });
        mockConnection.error.mockImplementation((callback) => {
            errorCallback = callback;
        });
        mockConnection.connectionSlow.mockImplementation((callback) => {
            connectionSlowCallback = callback;
        });

        // @ts-ignore
        global.$ = {
            connection: jest.fn().mockReturnValue(mockConnection),
            signalR: {
                connectionState: legacySignalrConnectionState,
            },
        };

        transport = mockTransport();
        authProvider = mockAuthProvider();

        fetchMock = mockFetch();

        installClock();
        mockMathRandom();
    });
    afterEach(() => uninstallClock());

    function mockSubscription() {
        type Callback = (state: SubscriptionState) => void;

        function addStateChangedCallback(
            this: ReturnType<typeof mockSubscription>,
            callback: Callback,
        ) {
            this.stateChangedCallback.push(callback);
        }

        function removeStateChangedCallback(
            this: ReturnType<typeof mockSubscription>,
            callback: Callback,
        ) {
            const index = this.stateChangedCallback.indexOf(callback);
            if (index > -1) {
                this.stateChangedCallback.splice(index, 1);
            }
        }

        const mock: Record<string, any> = {
            stateChangedCallback: [],
            onStreamingData: jest.fn(),
            onHeartbeat: jest.fn(),
            onConnectionUnavailable: jest.fn(),
            onConnectionAvailable: jest.fn(),
            reset: jest.fn(),
            onSubscribe: jest.fn(),
            onUnsubscribe: jest.fn(),
            onModify: jest.fn(),
            onRemove: jest.fn(),
            timeTillOrphaned: jest.fn(),
            addStateChangedCallback,
            removeStateChangedCallback,
            referenceId: '',
            onActivity: jest.fn(),
            dispose: jest.fn(),
        };

        return mock;
    }

    describe('init', () => {
        it('initializes the connection', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);

            // @ts-ignore
            expect(global.$.connection).toHaveBeenCalledTimes(1);
            // @ts-ignore
            expect(global.$.connection.mock.calls[0]).toEqual([
                'testUrl/streaming/connection',
            ]);
            expect(streaming.getQuery()).toEqual(
                'authorization=Bearer%20TOKEN&context=0000000000',
            );
            expect(mockConnection.start).toHaveBeenCalledTimes(1);
        });

        it('waits for the authentication token to be valid', () => {
            authProvider.getExpiry.mockImplementation(() => Date.now() - 1);
            const streaming = new Streaming(transport, 'testUrl', authProvider);

            expect(mockConnection.start).toHaveBeenCalledTimes(0);
            expect(authProvider.one).toHaveBeenCalledTimes(1);

            // change the token and expiry and call the one callback
            authProvider.getExpiry.mockImplementation(() => Date.now() + 1000);
            authProvider.getToken.mockImplementation(() => 'Bearer NEWTOKEN');
            authProvider.one.mock.calls[0][1]();

            expect(mockConnection.start).toHaveBeenCalledTimes(1);
            expect(streaming.getQuery()).toEqual(
                'authorization=Bearer%20NEWTOKEN&context=0000000000',
            );
        });
    });

    describe('network issues', () => {
        it('calls through', () => {
            // these calls are ignored for signal-r
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                {},
            );

            const subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            );

            expect(() => {
                subscription.onNetworkError?.(subscription);
            }).not.toThrow();

            expect(() => {
                streaming.orphanFinder.onOrphanFound(subscription);
            }).not.toThrow();
        });
    });

    describe('findRetryDelay', () => {
        it('find delay for level 0', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 0, defaultDelay);

            expect(result).toBe(1000);
        });

        it('find delay for level 1', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 1, defaultDelay);

            expect(result).toBe(2000);
        });

        it('find delay for level 4 in between two setup levels', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 4, defaultDelay);

            expect(result).toBe(2000);
        });

        it('find delay for level 5', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 5, defaultDelay);

            expect(result).toBe(5000);
        });

        it('find delay for retry index of 6', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 6, defaultDelay);

            expect(result).toBe(5000);
        });

        it('find delay for retry index of 100', () => {
            const mockedLevels = [
                { level: 0, delay: 1000 },
                { level: 1, delay: 2000 },
                { level: 5, delay: 5000 },
            ];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 100, defaultDelay);

            expect(result).toBe(5000);
        });

        it('return default delay if list of levels is empty', () => {
            const mockedLevels: RetryDelayLevel[] = [];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 0, defaultDelay);

            expect(result).toBe(500);
        });

        it('return default delay if list of levels is missing specific level', () => {
            const mockedLevels = [{ level: 2, delay: 5000 }];

            const defaultDelay = 500;
            const result = findRetryDelay(mockedLevels, 0, defaultDelay);

            expect(result).toBe(500);
        });
    });

    describe('connection states', () => {
        let streaming: Streaming;
        let subscription: any;
        let stateChangedSpy: jest.Mock;

        function givenStreaming(
            options?: Partial<StreamingConfigurableOptions>,
        ) {
            streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                options,
            );
            subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            );
            subscription.onConnectionAvailable = jest
                .fn()
                .mockName('onConnectionAvailable');
            subscription.onConnectionUnavailable = jest
                .fn()
                .mockName('onConnectionUnavailable');
            subscription.reset = jest.fn().mockName('reset');
            subscription.dispose = jest.fn().mockName('dispose');
            subscription.unsubscribeAndSubscribe = jest
                .fn()
                .mockName('unsubscribeAndSubscribe');
            stateChangedSpy = jest.fn().mockName('stateChanged');
            streaming.on('connectionStateChanged', stateChangedSpy);
            return streaming;
        }

        it('is initially initialising', () => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
            expect(streaming.retryCount).toBe(0);
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_INITIALIZING,
            );
        });

        it('tells subscriptions it is not connected when they are created before connect', () => {
            givenStreaming();
            // we test the property because we get the subscription after unavailable has been called, and before we spy on the method
            expect(subscription.connectionAvailable).toEqual(true);
        });

        it('tells subscriptions it is connected when they are created after connect', () => {
            givenStreaming();
            stateChangedCallback({ newState: 1 /* connected */ });
            subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            );
            // we test the property because we get the subscription after unavailable has been called, and before we spy on the method
            expect(subscription.connectionAvailable).toEqual(true);
        });

        it('does not cross communicate between two streaming instances', () => {
            givenStreaming();
            givenStreaming();
            startCallback();
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_STARTED,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_STARTED,
            ]);
        });

        it('becomes started when the connection callback returns', () => {
            givenStreaming();
            startCallback();
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_STARTED,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_STARTED,
            ]);
        });

        it('goes to the connecting state', () => {
            givenStreaming();
            stateChangedCallback({ newState: 0 /* connecting */ });
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_CONNECTING,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_CONNECTING,
            ]);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(0);
        });

        it('goes to the connected state', () => {
            givenStreaming();
            stateChangedCallback({ newState: 1 /* connected */ });
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_CONNECTED,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_CONNECTED,
            ]);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.onConnectionAvailable.mock.calls[0]).toEqual(
                [],
            );
        });

        it('stays connected if started is called after connected state change', () => {
            // this does happen - timing can go either way in the wild
            givenStreaming();
            stateChangedCallback({ newState: 1 /* connected */ });
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_CONNECTED,
            );
            startCallback();
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_CONNECTED,
            );
        });

        it('goes to the reconnected state', () => {
            givenStreaming();
            stateChangedCallback({ newState: 2 /* reconnecting */ });
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_RECONNECTING,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_RECONNECTING,
            ]);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(0);
        });

        it('goes to the disconnected state', () => {
            givenStreaming();
            stateChangedCallback({ newState: 4 /* disconnected */ });
            expect(streaming.connectionState).toEqual(
                streaming.CONNECTION_STATE_DISCONNECTED,
            );

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                streaming.CONNECTION_STATE_DISCONNECTED,
            ]);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(0);
        });

        it('if signal-r is reconnecting, it does not reset but it does tell the subscription the connection is available', () => {
            givenStreaming();
            stateChangedCallback({ newState: 1 /* connected */ });
            stateChangedCallback({ newState: 2 /* reconnecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });

        it('if signal-r disconnects, it tries to connect and resets subscriptions', () => {
            givenStreaming();
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(1);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(0);

            tick(1000); // default connection retry delay

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });

        it('if signal-r disconnects, it tries to connect and resets subscriptions, if the retry delay is 0', () => {
            givenStreaming({ connectRetryDelay: 0 });
            tick(1); // make sure the context id is different (in reality we will never be disconnected 0ms after starting to connect)

            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(1);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(0);
            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            tick(0);

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);

            expect(subscription.streamingContextId).toEqual('0000000100');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });

        it('if signal-r disconnects, it tries to connect and resets subscriptions, if the retry delay is 600,000', () => {
            givenStreaming({ connectRetryDelay: 600000 });
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(1);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(0);
            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            tick(600000);

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);

            expect(subscription.streamingContextId).toEqual('0060000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });

        it('if signal-r disconnects, when retry levels are provided but missing for specific retry, use connectRetryDelay', () => {
            const mockRetryLevels = [{ level: 1, delay: 2500 }];
            const connectRetryDelay = 9000;

            givenStreaming({
                connectRetryDelayLevels: mockRetryLevels,
                connectRetryDelay,
            });
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            // First disconnect
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            tick(9000);

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0000900000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });

        it('if signal-r disconnects, when retry levels are provided but empty, use connectRetryDelay', () => {
            const mockRetryLevels: RetryDelayLevel[] = [];
            const connectRetryDelay = 7500;

            givenStreaming({
                connectRetryDelayLevels: mockRetryLevels,
                connectRetryDelay,
            });
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            // First disconnect
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            tick(7500);

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0000750000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });

        it('if signal-r disconnects, it tries to reconnect using defined retry levels', () => {
            const mockRetryLevels = [
                { level: 0, delay: 2500 },
                { level: 1, delay: 5000 },
                { level: 2, delay: 7000 },
            ];

            givenStreaming({ connectRetryDelayLevels: mockRetryLevels });
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            // First disconnect
            stateChangedCallback({ newState: 4 /* disconnected */ });

            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            tick(2500);

            expect(mockConnection.start.mock.calls.length).toEqual(2);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0000250000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            // Second disconnect

            stateChangedCallback({ newState: 4 /* disconnected */ });

            tick(5000);

            expect(mockConnection.start.mock.calls.length).toEqual(3);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0000500000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            // Third disconnect

            stateChangedCallback({ newState: 4 /* disconnected */ });

            tick(7000);

            expect(mockConnection.start.mock.calls.length).toEqual(4);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0001000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );

            // Forth disconnect

            stateChangedCallback({ newState: 4 /* disconnected */ });

            tick(7000);

            expect(mockConnection.start.mock.calls.length).toEqual(5);
            stateChangedCallback({ newState: 0 /* connecting */ });
            stateChangedCallback({ newState: 1 /* connected */ });

            expect(subscription.streamingContextId).toEqual('0001700000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });
    });

    describe('data received', () => {
        it('splits the data and emits each result', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            const subscription2 = mockSubscription() as any;
            subscription2.referenceId = 'MySpy2';
            streaming.subscriptions.push(subscription2);

            const data1 = { ReferenceId: 'MySpy', Data: 'one' };
            const data2 = { ReferenceId: 'MySpy2', Data: 'two' };
            receivedCallback([data1, data2]);

            expect(subscription.onStreamingData.mock.calls.length).toEqual(1);
            expect(subscription.onStreamingData.mock.calls[0]).toEqual([data1]);

            expect(subscription2.onStreamingData.mock.calls.length).toEqual(1);
            expect(subscription2.onStreamingData.mock.calls[0]).toEqual([
                data2,
            ]);
        });
        it('handles a null received event', () => {
            expect(() => {
                new Streaming(transport, 'testUrl', authProvider);

                receivedCallback(null);
            }).not.toThrow();
        });
        it('handles data for a subscription not present', () => {
            expect(() => {
                new Streaming(transport, 'testUrl', authProvider);

                const data1 = { ReferenceId: 'MySpy', Data: 'one' };
                receivedCallback([data1]);
            }).not.toThrow();
        });
        it('handles a update without a reference id', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            // @ts-expect-error using mocked  subscription
            streaming.subscriptions.push(subscription);

            const data1 = {}; // using this to throw an exception, but could be anything
            const data2 = { ReferenceId: 'MySpy', Data: 'one' };
            receivedCallback([data1, data2]);

            expect(subscription.onStreamingData.mock.calls.length).toEqual(1);
            expect(subscription.onStreamingData.mock.calls[0]).toEqual([data2]);
        });
    });

    describe('signal-r events', () => {
        let streaming: Streaming;
        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
        });

        it('handles connection slow events', () => {
            const connectionSlowSpy = jest.fn().mockName('spyOnConnectionSlow');
            streaming.on(streaming.EVENT_CONNECTION_SLOW, connectionSlowSpy);
            connectionSlowCallback();
            expect(connectionSlowSpy.mock.calls.length).toEqual(1);
        });
        it('handles connection error events', () => {
            const warnLogSpy = jest.spyOn(log, 'warn');
            errorCallback('error details');

            expect(warnLogSpy.mock.calls.length).toEqual(1);
        });
        it('handles signal-r log calls', () => {
            const logDebugSpy = jest.spyOn(log, 'debug');
            // @ts-expect-error TS can't see that log property is added to the connection
            mockConnection.log('my message');
            expect(logDebugSpy.mock.calls.length).toEqual(1);
        });
    });

    describe('control messages', () => {
        let streaming: Streaming;
        let subscription: any;
        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });
            subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
        });

        it('handles heartbeats', () => {
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            receivedCallback([
                {
                    ReferenceId: '_heartbeat',
                    Heartbeats: [{ OriginatingReferenceId: 'MySpy' }],
                },
            ]);
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(1);
            expect(subscription.onHeartbeat.mock.calls[0]).toEqual([]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles heartbeats in data array', () => {
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            receivedCallback([
                {
                    ReferenceId: '_heartbeat',
                    Data: [
                        {
                            ReferenceId: '_heartbeat',
                            Heartbeats: [{ OriginatingReferenceId: 'MySpy' }],
                        },
                    ],
                },
            ]);
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(1);
            expect(subscription.onHeartbeat.mock.calls[0]).toEqual([]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles heartbeats in data object', () => {
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            receivedCallback([
                {
                    ReferenceId: '_heartbeat',
                    Data: { Heartbeats: [{ OriginatingReferenceId: 'MySpy' }] },
                },
            ]);
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(1);
            expect(subscription.onHeartbeat.mock.calls[0]).toEqual([]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles and ignores heartbeats for a subscription not present', () => {
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            receivedCallback([
                {
                    ReferenceId: '_heartbeat',
                    Heartbeats: [{ OriginatingReferenceId: 'foo' }],
                },
            ]);
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('Logs a warning on unsupported heartbeat message format', () => {
            const warnLogSpy = jest.spyOn(log, 'warn');
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            receivedCallback([
                {
                    ReferenceId: '_heartbeat',
                    SomeProp: { Heartbeats: { foo: 'bar' } },
                },
            ]);
            expect(subscription.onHeartbeat.mock.calls.length).toEqual(0);
            expect(warnLogSpy).toHaveBeenCalledTimes(1);
        });
        it('handles reset', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    TargetReferenceIds: ['MySpy'],
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });
        it('handles reset in data array', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    Data: [
                        {
                            ReferenceId: '_resetsubscriptions',
                            TargetReferenceIds: ['MySpy'],
                        },
                    ],
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });
        it('handles reset in data object', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    Data: { TargetReferenceIds: ['MySpy'] },
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });
        it('handles and ignores reset for a subscription not present', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    TargetReferenceIds: ['foo'],
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles and ignores reset for a subscription not present in data array', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    Data: [
                        {
                            ReferenceId: '_resetsubscriptions',
                            TargetReferenceIds: ['foo'],
                        },
                    ],
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles and ignores reset for a subscription not present in data object', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    Data: { TargetReferenceIds: ['foo'] },
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles reset all', () => {
            receivedCallback([{ ReferenceId: '_resetsubscriptions' }]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });
        it('handles reset all for empty TargetReferenceIds array', () => {
            receivedCallback([
                { ReferenceId: '_resetsubscriptions', TargetReferenceIds: [] },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([true]);
        });
        it('handles an unknown control event', () => {
            receivedCallback([
                { ReferenceId: '_foo', TargetReferenceIds: ['MySpy'] },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
        it('handles disconnect control message', () => {
            const disconnectRequestedSpy = jest
                .fn()
                .mockName('spyOnDisconnectRequested');

            streaming.on(
                streaming.EVENT_DISCONNECT_REQUESTED,
                disconnectRequestedSpy,
            );
            receivedCallback([{ ReferenceId: '_disconnect' }]);

            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(disconnectRequestedSpy).toHaveBeenCalledTimes(1);
        });
        it('handles reconnect control message', (done) => {
            let startPromiseResolver: (value?: unknown) => void;
            const startPromise = new Promise((resolve) => {
                startPromiseResolver = resolve;
            });

            mockConnection.start.mockImplementation(() => {
                if (stateChangedCallback) {
                    setTimeout(() => {
                        stateChangedCallback({
                            newState: legacySignalrConnectionState.connected,
                        });
                        startPromiseResolver();
                    });
                }
            });

            mockConnection.stop.mockImplementation(() => {
                if (stateChangedCallback) {
                    stateChangedCallback({
                        newState: legacySignalrConnectionState.disconnected,
                    });
                }
            });

            receivedCallback([{ ReferenceId: '_reconnect' }]);

            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);

            startPromise.then(() => {
                expect(subscription.reset.mock.calls.length).toEqual(1);
                done();
            });
        });
    });

    describe('onRemove', () => {
        it('unsubscribes everything', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription);
            expect(mockConnection.start.mock.calls.length).toEqual(1);
            mockConnection.start.mockClear();

            const orphanFinderStopMethodSpy = jest.spyOn(
                streaming.orphanFinder,
                'stop',
            );

            streaming.dispose();

            expect(subscription.dispose.mock.calls.length).toEqual(1);

            expect(orphanFinderStopMethodSpy.mock.calls.length).toEqual(1);

            stateChangedCallback({ newState: 4 /* disconnected */ });

            tick(10000);
            expect(mockConnection.start.mock.calls.length).toEqual(0);
        });

        it('disposes an individual subscription', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription);

            const subscription2 = mockSubscription();
            subscription2.referenceId = 'MySpy';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription2);

            // @ts-expect-error using mocked subscription
            streaming.disposeSubscription(subscription);

            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(1);
            expect(subscription.onRemove.mock.calls.length).toEqual(1);
            // @ts-expect-error using mocked subscription
            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.mock.calls.length).toEqual(1);
            expect(subscription2.onRemove.mock.calls.length).toEqual(1);

            // copes with being called twice
            // @ts-expect-error using mocked subscription
            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.mock.calls.length).toEqual(2);
            expect(subscription2.onRemove.mock.calls.length).toEqual(2);
        });
    });

    describe('subscription handling', () => {
        it('when a subscription is orphaned, the subscription is reset', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription);
            expect(subscription.reset.mock.calls.length).toEqual(0);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription);

            expect(subscription.reset.mock.calls.length).toEqual(1);
        });

        it('fires an error when multiple service paths orphan >20s apart', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription1 = mockSubscription();
            const subscription2 = mockSubscription();
            subscription1.referenceId = 'Sub1';
            subscription1.servicePath = 'sp1';
            subscription2.referenceId = 'Sub2';
            subscription2.servicePath = 'sp2';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription2);

            jest.spyOn(streaming, 'reconnect');

            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(21000);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(16);

            expect(streaming.reconnect).toHaveBeenCalledTimes(1);

            // @ts-expect-error orphanEvents is private
            expect(streaming.orphanEvents.length).toEqual(0);
        });

        it('does not fire an error when multiple service paths orphan >70s apart', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription1 = mockSubscription();
            const subscription2 = mockSubscription();
            subscription1.referenceId = 'Sub1';
            subscription1.servicePath = 'sp1';
            subscription2.referenceId = 'Sub2';
            subscription2.servicePath = 'sp2';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription2);

            jest.spyOn(streaming, 'reconnect');

            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(71000);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(16);

            expect(streaming.reconnect).not.toHaveBeenCalled();
        });

        it('does not fire an error when multiple service paths orphan <20s apart', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription1 = mockSubscription();
            const subscription2 = mockSubscription();
            subscription1.referenceId = 'Sub1';
            subscription1.servicePath = 'sp1';
            subscription2.referenceId = 'Sub2';
            subscription2.servicePath = 'sp2';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription2);

            jest.spyOn(streaming, 'reconnect');

            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(19000);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription1);
            // @ts-expect-error using mocked subscription
            streaming.orphanFinder.onOrphanFound(subscription2);
            tick(16);

            expect(streaming.reconnect).not.toHaveBeenCalled();
        });

        it('passes on subscribe calls', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            // @ts-expect-error using mocked subscription
            streaming.subscriptions.push(subscription);
            expect(subscription.onSubscribe.mock.calls.length).toEqual(0);

            // @ts-expect-error using mocked subscription
            streaming.subscribe(subscription);

            expect(subscription.onSubscribe.mock.calls.length).toEqual(1);
        });

        it('updates the orphan finder when a subscription is created', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            const subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            );

            const orphanFinderUpdateMethodSpy = jest.spyOn(
                streaming.orphanFinder,
                'update',
            );
            subscription.onSubscriptionCreated?.(subscription);

            expect(orphanFinderUpdateMethodSpy.mock.calls.length).toEqual(1);
        });

        it('passes on unsubscribe calls', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(0);

            streaming.unsubscribe(subscription);

            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(1);
        });

        it('passes options on modify', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({ newState: 1 /* connected */ });

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);

            const args = {};
            const options = {
                isPatch: false,
                isReplace: false,
            } as const;
            streaming.modify(subscription, args, options);

            expect(subscription.onModify.mock.calls.length).toEqual(1);
            expect(subscription.onModify.mock.calls[0][0]).toEqual(args);
            expect(subscription.onModify.mock.calls[0][1]).toEqual(options);
        });
    });

    describe('options', () => {
        it('has defaults', () => {
            new Streaming(transport, 'testUrl', authProvider);
            expect(mockConnection.start.mock.calls.length).toEqual(1);
            expect(mockConnection.start.mock.calls[0][0]).toEqual({
                waitForPageLoad: false,
                transport: ['webSockets', 'longPolling'],
            });
        });

        it('can override waitForPageLoad', () => {
            new Streaming(transport, 'testUrl', authProvider, {
                waitForPageLoad: true,
            });
            expect(mockConnection.start.mock.calls.length).toEqual(1);
            expect(mockConnection.start.mock.calls[0][0]).toEqual({
                waitForPageLoad: true,
                transport: ['webSockets', 'longPolling'],
            });
        });

        it('can override transport', () => {
            new Streaming(transport, 'testUrl', authProvider, {
                transportTypes: ['webSockets'],
            });
            expect(mockConnection.start.mock.calls.length).toEqual(1);
            expect(mockConnection.start.mock.calls[0][0]).toEqual({
                waitForPageLoad: false,
                transport: ['webSockets'],
            });
        });

        it('subscription should subscribe immediately until first reconnect, disconnect or fail happens', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                {
                    waitForPageLoad: true,
                    transport: ['webSockets'],
                },
            );

            // streaming Initializing state
            expect(streaming.shouldSubscribeBeforeStreamingSetup).toBe(true);
            streaming.createSubscription('root', '/test/test', {});
            expect(streaming.subscriptions[0].connectionAvailable).toBe(true);

            // streaming Connected state
            expect(streaming.subscriptions[0].latestActivity).toBeFalsy();
            stateChangedCallback({ newState: 1 /* Connected */ });
            expect(streaming.subscriptions[0].latestActivity).toBeTruthy();
            expect(streaming.shouldSubscribeBeforeStreamingSetup).toBe(false);
            streaming.createSubscription('root', '/test/test', {});
            expect(streaming.subscriptions[1].connectionAvailable).toBe(true);

            // // streaming Disconnected state
            stateChangedCallback({ newState: 4 /* Disconnected */ });
            expect(streaming.shouldSubscribeBeforeStreamingSetup).toBe(false);
            streaming.createSubscription('root', '/test/test', {});
            expect(streaming.subscriptions[2].connectionAvailable).toBe(false);
        });
    });

    describe('unsubscribeByTag', () => {
        let streaming: any;

        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
        });

        it('calls onUnsubscribeByTagPending on subscriptions matching endpoint and tag', (done) => {
            streaming.subscriptions.push({
                onUnsubscribeByTagPending: jest
                    .fn()
                    .mockName('onUnsubscribeByTagPending'),
                url: 'url',
                servicePath: 'servicePath',
                subscriptionData: {
                    Tag: 'tag',
                },
                addStateChangedCallback: () => {},
            });

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');

            setTimeout(() => {
                expect(
                    streaming.subscriptions[0].onUnsubscribeByTagPending,
                ).toHaveBeenCalled();
                done();
            });
        });

        it('does not call onSubscribeByTagPending on subscriptions not matching endpoint and tag', (done) => {
            streaming.subscriptions.push({
                onUnsubscribeByTagPending: jest
                    .fn()
                    .mockName('onUnsubscribeByTagPending'),
                url: 'url',
                servicePath: 'servicePath',
                subscriptionData: {
                    Tag: 'tag',
                },
                addStateChangedCallback: () => {},
            });

            streaming.unsubscribeByTag('servicePath', 'url', 'tag2');
            setTimeout(() => {
                expect(
                    streaming.subscriptions[0].onUnsubscribeByTagPending,
                ).not.toHaveBeenCalled();
                done();
            });
        });

        it('does not call to unsubscribe immediately', (done) => {
            streaming.subscriptions.push({
                onUnsubscribeByTagPending: jest
                    .fn()
                    .mockName('onUnsubscribeByTagPending'),
                url: 'url',
                servicePath: 'servicePath',
                subscriptionData: {
                    Tag: 'tag',
                },
                addStateChangedCallback: () => {},
            });

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');

            setTimeout(() => {
                expect(transport.delete).not.toHaveBeenCalled();
                done();
            });
        });

        it('does not call to unsubscribe when all subscriptions are not ready', (done) => {
            let subscriptionStateChangedCallback = () => {};

            streaming.subscriptions.push(
                {
                    onUnsubscribeByTagPending: jest
                        .fn()
                        .mockName('onUnsubscribeByTagPending'),
                    url: 'url',
                    servicePath: 'servicePath',
                    subscriptionData: {
                        Tag: 'tag',
                    },
                    addStateChangedCallback: (callback: () => void) => {
                        subscriptionStateChangedCallback = callback;
                    },
                    isReadyForUnsubscribeByTag: () => true,
                },
                {
                    onUnsubscribeByTagPending: jest
                        .fn()
                        .mockName('onUnsubscribeByTagPending'),
                    url: 'url',
                    servicePath: 'servicePath',
                    subscriptionData: {
                        Tag: 'tag',
                    },
                    addStateChangedCallback: () => {},
                    isReadyForUnsubscribeByTag: () => false,
                },
            );

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');
            subscriptionStateChangedCallback();

            setTimeout(() => {
                expect(transport.delete).not.toHaveBeenCalled();
                done();
            });
        });

        it('calls to unsubscribe when all subscriptions are ready', (done) => {
            let subscriptionStateChangedCallback = () => {};

            streaming.subscriptions.push(
                {
                    onUnsubscribeByTagPending: jest
                        .fn()
                        .mockName('onUnsubscribeByTagPending'),
                    url: 'url',
                    servicePath: 'servicePath',
                    subscriptionData: {
                        Tag: 'tag',
                    },
                    addStateChangedCallback: (callback: () => void) => {
                        subscriptionStateChangedCallback = callback;
                    },
                    removeStateChangedCallback: () => {},
                    isReadyForUnsubscribeByTag: () => true,
                    onUnsubscribeByTagComplete: jest
                        .fn()
                        .mockName('onUnsubscribeByTagComplete'),
                },
                {
                    onUnsubscribeByTagPending: jest
                        .fn()
                        .mockName('onUnsubscribeByTagPending'),
                    url: 'url',
                    servicePath: 'servicePath',
                    subscriptionData: {
                        Tag: 'tag',
                    },
                    addStateChangedCallback: () => {},
                    removeStateChangedCallback: () => {},
                    isReadyForUnsubscribeByTag: () => true,
                    onUnsubscribeByTagComplete: jest
                        .fn()
                        .mockName('onUnsubscribeByTagComplete'),
                },
            );

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');
            subscriptionStateChangedCallback();

            setTimeout(() => {
                expect(transport.delete).toHaveBeenCalled();
                expect(
                    streaming.subscriptions[0].onUnsubscribeByTagComplete,
                ).not.toHaveBeenCalled();
                done();
            });
        });

        it('calls onUnsubscribeByTagComplete when unsubscribe is complete', (done) => {
            let subscriptionStateChangedCallback = () => {};

            streaming.subscriptions.push({
                onUnsubscribeByTagPending: jest
                    .fn()
                    .mockName('onUnsubscribeByTagPending'),
                url: 'url',
                servicePath: 'servicePath',
                subscriptionData: {
                    Tag: 'tag',
                },
                addStateChangedCallback: (callback: () => void) => {
                    subscriptionStateChangedCallback = callback;
                },
                removeStateChangedCallback: jest
                    .fn()
                    .mockName('removeStateChangedCallback'),
                isReadyForUnsubscribeByTag: () => true,
                onUnsubscribeByTagComplete: jest
                    .fn()
                    .mockName('onUnsubscribeByTagComplete'),
            });

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');
            subscriptionStateChangedCallback();

            setTimeout(() => {
                expect(transport.delete).toHaveBeenCalled();
                transport.deleteResolve();
                setTimeout(() => {
                    expect(
                        streaming.subscriptions[0].onUnsubscribeByTagComplete,
                    ).toHaveBeenCalled();
                    done();
                });
            });
        });

        it('removes state change handler when unsubscribe is complete', (done) => {
            let subscriptionStateChangedCallback = () => {};

            streaming.subscriptions.push({
                onUnsubscribeByTagPending: jest
                    .fn()
                    .mockName('onUnsubscribeByTagPending'),
                url: 'url',
                servicePath: 'servicePath',
                subscriptionData: {
                    Tag: 'tag',
                },
                addStateChangedCallback: (callback: () => void) => {
                    subscriptionStateChangedCallback = callback;
                },
                removeStateChangedCallback: jest
                    .fn()
                    .mockName('removeStateChangedCallback'),
                isReadyForUnsubscribeByTag: () => true,
                onUnsubscribeByTagComplete: jest
                    .fn()
                    .mockName('onUnsubscribeByTagComplete'),
            });

            streaming.unsubscribeByTag('servicePath', 'url', 'tag');
            subscriptionStateChangedCallback();

            setTimeout(() => {
                expect(transport.delete).toHaveBeenCalled();
                transport.deleteResolve();
                setTimeout(() => {
                    expect(
                        streaming.subscriptions[0].removeStateChangedCallback,
                    ).toHaveBeenCalled();
                    done();
                });
            });
        });
    });

    describe('resetStreaming', () => {
        let spySocketClose: jest.Mock;
        let mockHubConnection: any;
        let mockSignalrCoreStart: ReturnType<typeof getResolvablePromise>;
        let mockPlainWebsocketStart: ReturnType<typeof getResolvablePromise>;
        let mockSignalMessageReceivedHandler: (...args: any[]) => void;
        let mockStreamCancel: ReturnType<typeof getResolvablePromise>;
        let mockCloseConnection: ReturnType<typeof getResolvablePromise>;
        let streaming: Streaming;

        class MockConnectionBuilder {
            withUrl() {
                return this;
            }
            withHubProtocol() {
                return this;
            }
            configureLogging() {
                return this;
            }
            withAutomaticReconnect() {
                return this;
            }
            build() {
                return mockHubConnection;
            }
        }

        function JsonHubProtocol() {}

        beforeEach(() => {
            spySocketClose = jest.fn().mockName('spySocketClose');

            mockPlainWebsocketStart = getResolvablePromise();
            // @ts-ignore
            global.WebSocket = jest.fn().mockImplementation(() => {
                const socket = {
                    close: spySocketClose,
                };

                setTimeout(() => {
                    // @ts-ignore
                    socket.onopen();
                    mockPlainWebsocketStart.resolve();
                });

                return socket;
            });

            // @ts-ignore
            global.signalrCore = {
                HubConnectionBuilder: MockConnectionBuilder,
                JsonHubProtocol,
                HttpTransportType: {
                    WebSockets: 1,
                    LongPolling: 4,
                },
            };

            const mockSubject = {
                subscribe: ({ next }: { next: (...args: any[]) => void }) => {
                    mockSignalMessageReceivedHandler = next;
                },
                cancelCallback: () => {
                    mockStreamCancel = getResolvablePromise();
                    return mockStreamCancel.promise;
                },
            };

            const closeCallbacks: Array<() => void> = [];
            mockHubConnection = {
                start: jest
                    .fn()
                    .mockName('signalrConnectionStart')
                    .mockImplementation(() => {
                        mockSignalrCoreStart = getResolvablePromise();

                        return mockSignalrCoreStart.promise;
                    }),
                stream: jest
                    .fn()
                    .mockName('message stream')
                    .mockImplementation(() => mockSubject),
                stop: jest.fn().mockImplementation(() => {
                    closeCallbacks.forEach((callback) => {
                        callback();
                    });
                }),
                invoke: (method: string) => {
                    if (method === 'CloseConnection') {
                        mockCloseConnection = getResolvablePromise();
                        return mockCloseConnection.promise;
                    }

                    return Promise.resolve();
                },
                onclose: jest.fn().mockImplementation((callback) => {
                    closeCallbacks.push(callback);
                }),
                onreconnecting: jest.fn(),
                onreconnected: jest.fn(),
                state: HubConnectionState.Connected,
            };
        });

        it('should reset streaming with new url and options', (done) => {
            streaming = new Streaming(transport, 'testUrl', authProvider, {
                transportTypes: [streamingTransports.PLAIN_WEBSOCKETS],
            });

            const subscription = mockSubscription();
            subscription.referenceId = 'testSubscription';
            streaming.subscriptions.push(subscription as any);

            fetchMock.resolve(200);

            mockPlainWebsocketStart.promise.then(() => {
                expect(subscription.onUnsubscribe).not.toHaveBeenCalled();

                streaming.resetStreaming('newStreamingUrl', {
                    transportTypes: [
                        streamingTransports.SIGNALR_CORE_WEBSOCKETS,
                    ],
                });

                expect(spySocketClose).toHaveBeenCalledTimes(1);
                expect(streaming.retryCount).toBe(0);
                expect(
                    subscription.onConnectionUnavailable,
                ).toHaveBeenCalledTimes(1);
                expect(mockHubConnection.start).toHaveBeenCalledTimes(1);

                done();
            });
        });

        it('should reset streaming when there is no active transport', (done) => {
            streaming = new Streaming(transport, 'testUrl', authProvider, {
                transportTypes: [],
            });

            const subscription = mockSubscription();
            subscription.referenceId = 'testSubscription';
            streaming.subscriptions.push(subscription as any);

            streaming.resetStreaming('newStreamingUrl', {
                transportTypes: [streamingTransports.PLAIN_WEBSOCKETS],
            });

            fetchMock.resolve(200);

            mockPlainWebsocketStart.promise.then(() => {
                expect(subscription.reset).toHaveBeenCalled();

                done();
            });
        });

        it('should fallback to on-premise streaming service if cloud streaming fails', (done) => {
            streaming = new Streaming(transport, 'testUrl', authProvider, {
                transportTypes: [streamingTransports.SIGNALR_CORE_WEBSOCKETS],
            });

            const subscription = mockSubscription();
            subscription.referenceId = 'testSubscription';
            streaming.subscriptions.push(subscription as any);

            let resolveResetStreamingPromise: (value?: unknown) => void;
            const resetStreamingPromise = new Promise((resolve) => {
                resolveResetStreamingPromise = resolve;
            });

            // mock fallback implementation
            streaming.on(streaming.EVENT_STREAMING_FAILED, () => {
                streaming.resetStreaming('newStreamingUrl', {
                    transportTypes: [streamingTransports.PLAIN_WEBSOCKETS],
                });

                resolveResetStreamingPromise();
            });

            mockSignalrCoreStart.resolve();

            mockSignalrCoreStart.promise
                .then(() => {
                    // push invalid message which should trigger disconnection and fallback
                    mockSignalMessageReceivedHandler({
                        Payload: '{ testKey: testValue',
                        PayloadFormat: 1,
                    });

                    // resolve connection close
                    mockStreamCancel.resolve();
                    return mockStreamCancel.promise;
                })
                .then(() => {
                    mockCloseConnection.resolve();
                    return mockStreamCancel.promise;
                })
                .then(() => {
                    // trigger streaming failed event
                    tick(10);
                });

            resetStreamingPromise
                .then(() => {
                    fetchMock.resolve(200);

                    return mockPlainWebsocketStart.promise;
                })
                .then(() => {
                    expect(subscription.reset).toHaveBeenCalled();

                    done();
                });
        });

        it('should clear reconnection timer while resetting streaming', () => {
            streaming = new Streaming(transport, 'testUrl', authProvider, {
                transportTypes: [streamingTransports.SIGNALR_CORE_WEBSOCKETS],
            });

            const subscription = mockSubscription();
            subscription.referenceId = 'testSubscription';
            streaming.subscriptions.push(subscription as any);

            // should trigger reconnection
            mockHubConnection.stop();

            expect(streaming.retryCount).toEqual(1);

            streaming.resetStreaming('newStreamingUrl', {
                transportTypes: [streamingTransports.PLAIN_WEBSOCKETS],
            });

            expect(streaming.retryCount).toEqual(0);
        });
    });

    describe('pause/resume streaming', () => {
        let streaming: Streaming;
        let subscription: Subscription;
        let mockConnectionStart: ReturnType<typeof getResolvablePromise>;
        let prevReferenceId: string | null;

        beforeEach(() => {
            mockConnection.start.mockImplementation(() => {
                mockConnectionStart = getResolvablePromise();
                setTimeout(() => {
                    streaming.connection.transport?.stateChangedCallback(
                        connectionConstants.CONNECTION_STATE_CONNECTED,
                    );
                    mockConnectionStart.resolve();
                });
            });

            mockConnection.stop.mockImplementation(() => {
                streaming.connection.transport?.stateChangedCallback(
                    connectionConstants.CONNECTION_STATE_DISCONNECTED,
                );
            });

            streaming = new Streaming(transport, 'testUrl', authProvider);

            mockConnectionStart.promise.then(() => {
                subscription = streaming.createSubscription('test', 'v1/url');
                prevReferenceId = subscription.referenceId;
            });
        });

        it('should pause and resume streaming', (done) => {
            mockConnectionStart.promise
                .then(() => {
                    expect(transport.post).toHaveBeenCalledWith(
                        'test',
                        'v1/url',
                        null,
                        expect.objectContaining({
                            body: expect.objectContaining({
                                ContextId: '0000000000',
                                ReferenceId: prevReferenceId,
                            }),
                        }),
                    );

                    // set subscription status to connected
                    transport.postResolve({
                        status: '200',
                        response: { Snapshot: { Data: [1, 'fish', 3] } },
                    });

                    return Promise.resolve();
                })
                .then(() => {
                    expect(subscription.currentState).toBe(
                        subscription.STATE_SUBSCRIBED,
                    );

                    transport.post.mockClear();

                    streaming.pause();

                    // should delete subscription immediately
                    expect(transport.delete).toHaveBeenCalledWith(
                        'test',
                        'v1/url/{contextId}/{referenceId}',
                        {
                            contextId: '0000000000',
                            referenceId: prevReferenceId,
                        },
                    );

                    transport.deleteResolve();

                    return Promise.resolve();
                })
                .then(() => {
                    expect(subscription.currentState).toBe(
                        subscription.STATE_UNSUBSCRIBED,
                    );

                    // should not subscribe until connection is available again
                    expect(transport.post).not.toHaveBeenCalledWith(
                        'test',
                        'v1/url',
                        null,
                        expect.objectContaining({
                            body: expect.objectContaining({
                                ContextId: '0000000000',
                            }),
                        }),
                    );

                    streaming.resume();

                    // wait for new start promise
                    return mockConnectionStart.promise;
                })
                .then(() => {
                    expect(prevReferenceId).not.toEqual(
                        subscription.referenceId,
                    );
                    expect(transport.post).toHaveBeenCalledWith(
                        'test',
                        'v1/url',
                        null,
                        expect.objectContaining({
                            body: expect.objectContaining({
                                ContextId: '0000000000',
                                ReferenceId: subscription.referenceId,
                            }),
                        }),
                    );

                    expect(subscription.currentState).toBe(
                        subscription.STATE_SUBSCRIBE_REQUESTED,
                    );
                    done();
                });
        });
    });
});
