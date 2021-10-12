/* eslint-disable */

jest.mock('./connection/transport/websocket-transport');
jest.mock('./connection/connection');

import {
    installClock,
    uninstallClock,
    tick,
    setTimeout,
} from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import WebSocketTransport from './connection/transport/websocket-transport';
import * as original from './connection/connection';
import mockMathRandom from '../../test/mocks/math-random';
import Streaming from './streaming';
import type { StreamingConfigurableOptions, ConnectionState } from './types';
import * as constants from './connection/constants';
import mockAuthProvider from '../../test/mocks/authProvider';
import Subscription from './subscription';

const mockedConnection = original as jest.Mocked<typeof original>;
const Connection = mockedConnection.default;

const defaultOptions: Partial<StreamingConfigurableOptions> = {
    transportTypes: ['plainWebSockets', 'webSockets'],
};

describe('openapi Streaming', () => {
    let stateChangedCallback: (arg: ConnectionState) => void;
    let connectionSlowCallback: () => void;
    let startCallback: () => void;
    let receivedCallback: (arg: any) => void;
    let authProvider: any;
    let mockConnection;
    let transport: ReturnType<typeof mockTransport>;

    beforeEach(() => {
        (WebSocketTransport.isSupported as jest.Mock).mockReturnValue(true);
        WebSocketTransport.prototype.isSupported =
            WebSocketTransport.isSupported;

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
        mockConnection.connectionSlow.mockImplementation((callback) => {
            connectionSlowCallback = callback;
        });

        Connection.prototype.start.mockImplementation(
            (callback: () => void) => {
                startCallback = callback;
            },
        );

        Connection.prototype.setStateChangedCallback.mockImplementation(
            (callback: (nextState: ConnectionState) => void) => {
                stateChangedCallback = callback;
            },
        );

        Connection.prototype.setReceivedCallback.mockImplementation(
            (callback: (args: any) => void) => {
                receivedCallback = callback;
            },
        );

        Connection.prototype.setConnectionSlowCallback.mockImplementation(
            (callback: () => void) => {
                connectionSlowCallback = callback;
            },
        );

        // @ts-ignore
        global.$ = {
            connection: jest.fn().mockReturnValue(mockConnection),
            signalR: {
                connectionState: {
                    connecting: 0,
                    connected: 1,
                    reconnecting: 2,
                    disconnected: 4,
                },
            },
        };

        // @ts-ignore
        global.WebSocket = jest.fn().mockImplementation(() => {
            return {
                close: jest.fn(),
            };
        });

        transport = mockTransport();
        authProvider = mockAuthProvider();

        installClock();
        mockMathRandom();
    });

    afterEach(() => {
        uninstallClock();
        jest.clearAllMocks();
    });

    function mockSubscription() {
        return {
            onStreamingData: jest.fn(),
            onHeartbeat: jest.fn(),
            onConnectionUnavailable: jest.fn(),
            reset: jest.fn(),
            onSubscribe: jest.fn(),
            onUnsubscribe: jest.fn(),
            onModify: jest.fn(),
            dispose: jest.fn(),
            referenceId: '',
        };
    }

    describe('init', () => {
        it('initializes the connection with plain websocket supported', () => {
            const options: Partial<StreamingConfigurableOptions> = {
                transportTypes: ['plainWebSockets', 'webSockets'],
            };
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                options,
            );
            Connection.prototype.getQuery.mockReturnValue(
                '?contextId=0000000000&Authorization=TOKEN',
            );
            expect(streaming.getQuery()).toEqual(
                '?contextId=0000000000&Authorization=TOKEN',
            );
            expect(Connection.prototype.getQuery).toHaveBeenCalledTimes(1);
        });
    });

    describe('connection states', () => {
        let streaming: Streaming;
        let subscription: Subscription & {
            onConnectionAvailable: jest.Mock;
            reset: jest.Mock;
            onConnectionUnavailable: jest.Mock;
        };
        let stateChangedSpy: jest.Mock;

        function givenStreaming(
            options?: Partial<StreamingConfigurableOptions>,
        ) {
            options = Object.assign({}, options, defaultOptions);

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
            ) as any;

            subscription.onConnectionAvailable = jest
                .fn()
                .mockName('onConnectionAvailable');
            subscription.onConnectionUnavailable = jest
                .fn()
                .mockName('onConnectionUnavailable');
            subscription.reset = jest.fn().mockName('reset');
            subscription.dispose = jest.fn().mockName('dispose');
            stateChangedSpy = jest.fn().mockName('stateChanged');
            streaming.on('connectionStateChanged', stateChangedSpy);
            return streaming;
        }

        it('is initially initialising', () => {
            streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
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
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            ) as any;
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
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
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
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
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
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
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
            stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);
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
            stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);
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

        it('if websocket is reconnecting, it does not reset but it does tell the subscription the connection is available', () => {
            givenStreaming();
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            stateChangedCallback(constants.CONNECTION_STATE_RECONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });

        it('if websocket disconnects, it tries to connect and resets subscriptions', () => {
            givenStreaming();
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(1);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(0);

            tick(1000); // default connection retry delay

            expect(Connection.prototype.start.mock.calls.length).toEqual(2);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);
        });

        it('if websocket disconnects, it tries to connect and resets subscriptions, if the retry delay is 0', () => {
            givenStreaming({ connectRetryDelay: 0 });
            tick(1); // make sure the context id is different (in reality we will never be disconnected 0ms after starting to connect)

            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);

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

            expect(Connection.prototype.start.mock.calls.length).toEqual(2);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);

            expect(subscription.streamingContextId).toEqual('0000000100');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });

        it('if websocket disconnects, it tries to connect and resets subscriptions, if the retry delay is 600,000', () => {
            givenStreaming({ connectRetryDelay: 600000 });
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
            stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);

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

            expect(Connection.prototype.start.mock.calls.length).toEqual(2);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTING);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            expect(
                subscription.onConnectionAvailable.mock.calls.length,
            ).toEqual(2);
            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);

            expect(subscription.streamingContextId).toEqual('0060000000');
            expect(subscription.streamingContextId).toEqual(
                streaming.contextId,
            );
        });
    });

    describe('data received', () => {
        it('splits the data and emits each result', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription as any);
            const subscription2 = mockSubscription();
            subscription2.referenceId = 'MySpy2';
            streaming.subscriptions.push(subscription2 as any);

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
                new Streaming(
                    transport,
                    'testUrl',
                    authProvider,
                    defaultOptions,
                );

                receivedCallback(null);
            }).not.toThrow();
        });
        it('handles data for a subscription not present', () => {
            expect(() => {
                new Streaming(
                    transport,
                    'testUrl',
                    authProvider,
                    defaultOptions,
                );

                const data1 = { ReferenceId: 'MySpy', Data: 'one' };
                receivedCallback([data1]);
            }).not.toThrow();
        });
        it('handles a update without a reference id', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );

            const subscription = mockSubscription();
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription as any);

            const data1 = {}; // using this to throw an exception, but could be anything
            const data2 = { ReferenceId: 'MySpy', Data: 'one' };
            receivedCallback([data1, data2]);

            expect(subscription.onStreamingData.mock.calls.length).toEqual(1);
            expect(subscription.onStreamingData.mock.calls[0]).toEqual([data2]);
        });
    });

    describe('websocket events', () => {
        let streaming: Streaming;
        beforeEach(() => {
            streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
        });

        it('handles connection slow events', () => {
            const connectionSlowSpy = jest.fn().mockName('spyOnConnectionSlow');
            streaming.on(streaming.EVENT_CONNECTION_SLOW, connectionSlowSpy);
            connectionSlowCallback();
            expect(connectionSlowSpy.mock.calls.length).toEqual(1);
        });
    });

    describe('network issues', () => {
        it('calls through', () => {
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

            jest.spyOn(streaming.connection, 'onSubscribeNetworkError');
            jest.spyOn(streaming.connection, 'onOrphanFound');

            expect(() => {
                subscription.onNetworkError?.();
            }).not.toThrow();

            expect(
                streaming.connection.onSubscribeNetworkError,
            ).toBeCalledTimes(1);

            expect(() => {
                streaming.orphanFinder.onOrphanFound(subscription);
            }).not.toThrow();

            expect(streaming.connection.onOrphanFound).toBeCalledTimes(1);
        });
    });

    describe('control messages', () => {
        let streaming;
        let subscription: any;
        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);
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
        it('handles reset', () => {
            receivedCallback([
                {
                    ReferenceId: '_resetsubscriptions',
                    TargetReferenceIds: ['MySpy'],
                },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);
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
        it('handles reset all', () => {
            receivedCallback([{ ReferenceId: '_resetsubscriptions' }]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);
        });
        it('handles reset all for empty TargetReferenceIds array', () => {
            receivedCallback([
                { ReferenceId: '_resetsubscriptions', TargetReferenceIds: [] },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(subscription.reset.mock.calls[0]).toEqual([]);
        });
        it('handles an unknown control event', () => {
            receivedCallback([
                { ReferenceId: '_foo', TargetReferenceIds: ['MySpy'] },
            ]);
            expect(subscription.reset.mock.calls.length).toEqual(0);
        });
    });

    describe('dispose', () => {
        it('unsubscribes everything', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription: any = mockSubscription();
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            expect(Connection.prototype.start.mock.calls.length).toEqual(1);
            Connection.prototype.start.mockClear();

            const orphanFinderStopMethodSpy = jest.spyOn(
                streaming.orphanFinder,
                'stop',
            );

            streaming.dispose();

            expect(
                subscription.onConnectionUnavailable.mock.calls.length,
            ).toEqual(1);
            expect(subscription.reset.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls[0][0]).toEqual('root');
            expect(transport.delete.mock.calls[0][1]).toEqual(
                'v1/subscriptions/{contextId}',
            );
            expect(transport.delete.mock.calls[0][2]).toEqual({
                contextId: '0000000000',
            });

            expect(orphanFinderStopMethodSpy.mock.calls.length).toEqual(1);

            stateChangedCallback(constants.CONNECTION_STATE_DISCONNECTED);

            tick(10000);
            expect(Connection.prototype.start.mock.calls.length).toEqual(0);
        });

        it('disposes an individual subscription', () => {
            const streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            const subscription2 = mockSubscription() as any;
            subscription2.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription2);

            streaming.disposeSubscription(subscription);

            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(1);
            expect(subscription.dispose.mock.calls.length).toEqual(1);
            expect(streaming.subscriptions.length).toEqual(1);

            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.mock.calls.length).toEqual(1);
            expect(subscription2.dispose.mock.calls.length).toEqual(1);
            expect(streaming.subscriptions.length).toEqual(0);

            // copes with being called twice

            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.mock.calls.length).toEqual(2);
            expect(subscription2.dispose.mock.calls.length).toEqual(2);
            expect(streaming.subscriptions.length).toEqual(0);
        });
    });

    describe('subscription handling', () => {
        it('when a subscription is orphaned, the subscription is reset', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            expect(subscription.reset.mock.calls.length).toEqual(0);

            streaming.orphanFinder.onOrphanFound(subscription);

            expect(subscription.reset.mock.calls.length).toEqual(1);
        });

        it('passes on subscribe calls', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            expect(subscription.onSubscribe.mock.calls.length).toEqual(0);

            streaming.subscribe(subscription);

            expect(subscription.onSubscribe.mock.calls.length).toEqual(1);
        });

        it('updates the orphan finder when a subscription is created', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
            const subscription = streaming.createSubscription(
                'root',
                '/test/test',
                {},
            );

            const orphanFinderUpdateMethodSpy = jest.spyOn(
                streaming.orphanFinder,
                'update',
            );
            subscription.onSubscriptionCreated?.();

            expect(orphanFinderUpdateMethodSpy.mock.calls.length).toEqual(1);
        });

        it('passes on subscribe calls', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);
            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(0);

            streaming.unsubscribe(subscription);

            expect(subscription.onUnsubscribe.mock.calls.length).toEqual(1);
        });

        it('passes options on modify', () => {
            const streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
            stateChangedCallback(constants.CONNECTION_STATE_CONNECTED);

            const subscription = mockSubscription() as any;
            subscription.referenceId = 'MySpy';
            streaming.subscriptions.push(subscription);

            const args = {};
            const options = {
                isPatch: false,
                isReplace: false,
                patchArgsDelta: {},
            };
            streaming.modify(subscription, args, options);

            expect(subscription.onModify.mock.calls.length).toEqual(1);
            expect(subscription.onModify.mock.calls[0][0]).toEqual(args);
            expect(subscription.onModify.mock.calls[0][1]).toEqual(options);
        });
    });

    describe('unsubscribeByTag', () => {
        let streaming: Streaming;

        beforeEach(() => {
            streaming = new Streaming(
                transport,
                'testUrl',
                authProvider,
                defaultOptions,
            );
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
            } as any);

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
            } as any);

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
            } as any);

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
                } as any,
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
                } as any,
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
                } as any,
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
                } as any,
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
                addStateChangedCallback: (callback: () => {}) => {
                    subscriptionStateChangedCallback = callback;
                },
                removeStateChangedCallback: jest
                    .fn()
                    .mockName('removeStateChangedCallback'),
                isReadyForUnsubscribeByTag: () => true,
                onUnsubscribeByTagComplete: jest
                    .fn()
                    .mockName('onUnsubscribeByTagComplete'),
            } as any);

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
            } as any);

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
});
