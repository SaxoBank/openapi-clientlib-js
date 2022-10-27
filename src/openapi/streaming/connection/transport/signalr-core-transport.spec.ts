import {
    installClock,
    uninstallClock,
    tick,
    getResolvablePromise,
    setTimeout,
} from '../../../../test/utils';
import mockMathRandom from '../../../../test/mocks/math-random';
import mockAuthProvider from '../../../../test/mocks/authProvider';
import * as constants from '../constants';
import jsonPayload from './payload.json';
import SignalrCoreTransport from './signalr-core-transport';
import 'fast-text-encoding';
import { HubConnectionState } from '@microsoft/signalr';

const CONTEXT_ID = '0000000000';
const BASE_URL = 'testUrl';

const NOOP: (...args: any) => void = () => {};

type Callback = (...args: any) => void;

describe('openapi SignalR core Transport', () => {
    let subscribeNextHandler = NOOP;
    let subscribeErrorHandler = NOOP;

    let mockHubConnection: any;
    let spyOnMessageStream: jest.Mock;
    let spyOnConnectionStop: jest.Mock;
    let spyOnStartCallback: jest.Mock;
    let spyOnStateChangedCallback: jest.Mock;
    let spyOnTransportFailedCallback: jest.Mock;
    let mockStart: ReturnType<typeof getResolvablePromise>;
    let mockStreamCancel: ReturnType<typeof getResolvablePromise>;
    let mockRenewToken: ReturnType<typeof getResolvablePromise>;
    let mockReconnect: () => void;
    let mockReconnecting: () => void;
    let mockCloseConnection: ReturnType<typeof getResolvablePromise>;
    let tokenFactory: () => void;
    let authprovider: any;

    class MockConnectionBuilder {
        withUrl(url: string, options: Record<string, any>) {
            tokenFactory = options.accessTokenFactory;
            mockHubConnection.baseUrl = url;

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

    function wait() {
        return new Promise<void>((resolve) => {
            setTimeout(resolve);
        });
    }

    function MockJsonHubProtocol() {
        // @ts-expect-error
        this.name = 'json';
    }

    window.signalrCore = {
        // @ts-expect-error
        HubConnectionBuilder: MockConnectionBuilder,
        // @ts-expect-error
        JsonHubProtocol: MockJsonHubProtocol,
    };

    beforeEach(() => {
        const mockSubject = {
            subscribe: ({
                next,
                error,
            }: {
                next: (...args: any) => void;
                error: (...args: any) => void;
            }) => {
                subscribeNextHandler = next;
                subscribeErrorHandler = error;
            },
            cancelCallback: () => {
                mockStreamCancel = getResolvablePromise();
                return mockStreamCancel.promise;
            },
        };
        const closeCallbacks: Callback[] = [];
        const reconnectedCallbacks: Callback[] = [];
        const reconnectingCallbacks: Callback[] = [];

        spyOnMessageStream = jest
            .fn()
            .mockName('message stream')
            .mockImplementation(() => mockSubject);

        spyOnConnectionStop = jest
            .fn()
            .mockName('connection stop')
            .mockImplementation(() =>
                setTimeout(() =>
                    closeCallbacks.forEach((callback) => callback()),
                ),
            );

        mockHubConnection = {
            start: () => {
                // mock token use
                tokenFactory();

                mockStart = getResolvablePromise();
                return mockStart.promise;
            },
            state: HubConnectionState.Connected,
            stream: spyOnMessageStream,
            stop: spyOnConnectionStop,
            invoke: (method: string, ...args: any): any => {
                if (method === 'RenewToken') {
                    if (args[0] === undefined) {
                        throw Error('Token is required');
                    }

                    mockRenewToken = getResolvablePromise();
                    return mockRenewToken.promise;
                }

                if (method === 'CloseConnection') {
                    mockCloseConnection = getResolvablePromise();
                    return mockCloseConnection.promise;
                }
            },
            onclose: (callback: Callback) => closeCallbacks.push(callback),
            onreconnecting: (callback: Callback) =>
                reconnectingCallbacks.push(callback),
            onreconnected: (callback: Callback) =>
                reconnectedCallbacks.push(callback),
        };

        mockReconnect = () => {
            // mock token use
            tokenFactory();
            setTimeout(() => {
                reconnectedCallbacks.forEach((callback) => callback());
            });
        };

        mockReconnecting = () => {
            reconnectingCallbacks.forEach((callback) => callback());
        };

        installClock();

        spyOnStartCallback = jest.fn().mockName('connection start callback');
        spyOnStateChangedCallback = jest
            .fn()
            .mockName('connection state changed callback');
        spyOnTransportFailedCallback = jest
            .fn()
            .mockName('transport failed callback');

        mockMathRandom();

        authprovider = mockAuthProvider();
    });

    afterEach(() => {
        uninstallClock();
        subscribeNextHandler = NOOP;
        subscribeErrorHandler = NOOP;
        // @ts-ignore
        mockStart = null;
        // @ts-ignore
        mockStreamCancel = null;
        // @ts-ignore
        mockRenewToken = undefined;
        // @ts-ignore
        mockCloseConnection = undefined;
    });

    describe('start', () => {
        let transport: any;

        beforeEach(() => {
            transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );
            transport.setStateChangedCallback(spyOnStateChangedCallback);

            transport.updateQuery(
                authprovider.getToken(),
                CONTEXT_ID,
                authprovider.getExpiry(),
            );
        });

        it('should create message stream and call state change handler upon transport start invocation', async () => {
            const startPromise = transport.start({}, spyOnStartCallback);

            expect(spyOnStartCallback).not.toBeCalled();
            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                1,
                constants.CONNECTION_STATE_CONNECTING,
            );

            // resolve handshake request
            mockStart.resolve();

            await startPromise;

            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                2,
                constants.CONNECTION_STATE_CONNECTED,
            );
            expect(spyOnStartCallback).toBeCalledTimes(1);
            expect(spyOnMessageStream).toBeCalledTimes(1);
        });

        it('should renew session with new token if token was updated while response was in flight', async () => {
            const startPromise = transport.start({}, spyOnStartCallback);

            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                1,
                constants.CONNECTION_STATE_CONNECTING,
            );

            // mock token update
            transport.updateQuery('NEW_TOKEN', CONTEXT_ID);

            // resolve handshake request
            mockStart.resolve();

            await startPromise;

            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                2,
                constants.CONNECTION_STATE_CONNECTED,
            );

            expect(mockRenewToken).toBeDefined();
        });

        it('should call transport fail callback if handshake request fails with valid status code', async () => {
            const startPromise = transport.start({}, spyOnStartCallback);

            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTING,
            );

            // fail handshake request with valid server error
            const error = new Error('Internal server error');
            // @ts-ignore
            error.statusCode = 500;
            mockStart.reject(error);

            await startPromise;

            expect(spyOnStartCallback).not.toBeCalled();
            // connecting and then reconnecting
            expect(spyOnStateChangedCallback.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    4,
                  ],
                  Array [
                    16,
                  ],
                ]
            `);
            expect(spyOnTransportFailedCallback).toBeCalledTimes(1);
        });

        it('should retry if experimentalRetryConnectCount is set and then call transport fail callback if handshake request fails', async () => {
            const startPromise = transport.start(
                { experimentalRetryConnectCount: 2 },
                spyOnStartCallback,
            );

            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTING,
            );

            // fail handshake request with valid server error
            const error = new Error('Internal server error');
            // @ts-ignore
            error.statusCode = 500;
            mockStart.reject(error);

            await wait();
            mockStart.reject(error);

            await wait();
            mockStart.reject(error);

            expect(spyOnTransportFailedCallback).toBeCalledTimes(0);

            await wait();
            mockStart.reject(error);

            await startPromise;

            expect(spyOnStartCallback).not.toBeCalled();
            // connecting and then reconnecting
            expect(spyOnStateChangedCallback.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    4,
                  ],
                  Array [
                    4,
                  ],
                  Array [
                    4,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    16,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                ]
            `);
            expect(spyOnTransportFailedCallback).toBeCalledTimes(1);
        });

        it('should retry if experimentalRetryConnectCount is set and eventually succeed', async () => {
            const startPromise = transport.start(
                { experimentalRetryConnectCount: 2 },
                spyOnStartCallback,
            );

            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTING,
            );

            // fail handshake request with valid server error
            const error = new Error('Internal server error');
            // @ts-ignore
            error.statusCode = 500;
            mockStart.reject(error);

            await wait();
            mockStart.reject(error);

            await wait();
            mockStart.resolve();

            await startPromise;

            expect(spyOnStartCallback).toBeCalledTimes(1);
            // connecting and then reconnecting and finally connected
            expect(spyOnStateChangedCallback.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    4,
                  ],
                  Array [
                    4,
                  ],
                  Array [
                    4,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    32,
                  ],
                  Array [
                    8,
                  ],
                ]
            `);
            expect(spyOnTransportFailedCallback).toBeCalledTimes(0);
        });

        it('should trigger disconnect if error is received while starting message streaming', async () => {
            const startPromise = transport.start({}, spyOnStartCallback);

            // resolve handshake request
            mockStart.resolve();

            await startPromise;

            subscribeErrorHandler(new Error('Streaming error'));
            mockCloseConnection.resolve();
            await mockCloseConnection.promise;

            tick(10);

            expect(spyOnTransportFailedCallback).toBeCalledTimes(0);
            expect(spyOnStateChangedCallback.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    4,
                  ],
                  Array [
                    8,
                  ],
                ]
            `);
        });
    });

    describe('on message received', () => {
        let spyReceivedCallback: jest.Mock;
        let startPromise: Promise<any>;

        beforeEach(() => {
            spyReceivedCallback = jest.fn().mockName('received callback');
            const transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );
            transport.setReceivedCallback(spyReceivedCallback);

            startPromise = transport.start({}) as Promise<any>;
            mockStart.resolve();
        });

        it('should parse message correctly', (done) => {
            startPromise.then(() => {
                const utf8EncodedPayload = new window.TextEncoder().encode(
                    JSON.stringify(jsonPayload),
                );

                const base64Payload = window.btoa(
                    new Uint8Array(utf8EncodedPayload).reduce(
                        (data, byte) => data + String.fromCharCode(byte),
                        '',
                    ),
                );

                subscribeNextHandler({
                    ReferenceId: '12',
                    PayloadFormat: 1,
                    Payload: base64Payload,
                });

                expect(spyReceivedCallback).toBeCalledWith({
                    ReferenceId: '12',
                    DataFormat: 0,
                    Data: jsonPayload,
                });

                done();
            });
        });

        it('should fallback to other transport on message parsing failure', (done) => {
            startPromise.then(() => {
                subscribeNextHandler({
                    ReferenceId: '12',
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "some-key": 123 '),
                });

                expect(spyReceivedCallback).not.toBeCalled();

                mockStreamCancel.resolve();
                mockStreamCancel.promise
                    .then(() => {
                        mockCloseConnection.resolve();
                        return mockCloseConnection.promise;
                    })
                    .then(() => {
                        expect(spyOnConnectionStop).toBeCalledTimes(1);

                        tick(10);
                        expect(spyOnStateChangedCallback).not.toBeCalledWith(
                            constants.CONNECTION_STATE_DISCONNECTED,
                        );

                        expect(spyOnTransportFailedCallback).toBeCalledTimes(1);
                        done();
                    });
            });
        });
    });

    describe('updateQuery', () => {
        it('should renew session on token update', (done) => {
            const transport = new SignalrCoreTransport(BASE_URL);
            const startPromise = transport.start({}) as Promise<any>;
            mockStart.resolve();

            startPromise.then(() => {
                transport.updateQuery(
                    authprovider.getToken(),
                    CONTEXT_ID,
                    authprovider.getExpiry(),
                    true,
                );

                expect(mockRenewToken).toBeDefined();
                done();
            });
        });
    });

    describe('when renewal call fails', () => {
        let transport: any;
        let startPromise: Promise<any>;
        let renewalPromise: Promise<any>;
        let spyOnUnauthorizedCallback: jest.Mock;

        beforeEach(() => {
            spyOnUnauthorizedCallback = jest
                .fn()
                .mockName('unauthorised callback');
            transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );

            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.setUnauthorizedCallback(spyOnUnauthorizedCallback);

            // update instance variables
            transport.updateQuery(
                authprovider.getToken(),
                CONTEXT_ID,
                authprovider.getExpiry(),
            );
            startPromise = transport.start({});
            // wait for state to change to connected
            renewalPromise = startPromise.then(() => transport.renewSession());
            mockStart.resolve();
        });

        it('should call disconnect if session is not found', (done) => {
            startPromise.then(() => {
                expect(mockRenewToken).toBeDefined();

                mockRenewToken.resolve({ Status: 2 });
            });

            renewalPromise
                .then(() => {
                    mockStreamCancel.resolve();
                    return mockStreamCancel.promise;
                })
                .then(() => {
                    mockCloseConnection.resolve();
                    return mockCloseConnection.promise;
                })
                .then(() => {
                    expect(spyOnTransportFailedCallback).not.toBeCalled();
                    expect(spyOnConnectionStop).toBeCalled();

                    tick(10);
                    expect(spyOnStateChangedCallback).toBeCalledWith(
                        constants.CONNECTION_STATE_DISCONNECTED,
                    );
                    done();
                });
        });

        it('should retry renewal if there is a network error', (done) => {
            startPromise.then(() => {
                expect(mockRenewToken).toBeDefined();

                // mock before it calls renewSession again
                transport.renewSession = jest
                    .fn()
                    .mockName('renew session')
                    .mockImplementation(() => Promise.resolve());

                mockRenewToken.reject(new Error('Network error'));
            });

            renewalPromise.then(() => {
                expect(transport.renewSession).toBeCalledTimes(1);
                expect(spyOnConnectionStop).not.toBeCalled();
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                done();
            });
        });

        it('should ignore if token is updated before prev response was received', (done) => {
            startPromise.then(() => {
                expect(mockRenewToken).toBeDefined();

                transport.updateQuery('NEW_TOKEN', CONTEXT_ID);
                mockRenewToken.resolve({ Status: 1 });
            });

            renewalPromise.then(() => {
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                expect(spyOnConnectionStop).not.toBeCalled();
                done();
            });
        });

        it('should call unauthorized callback', (done) => {
            startPromise.then(() => {
                expect(mockRenewToken).toBeDefined();

                mockRenewToken.resolve({ Status: 1 });
            });

            renewalPromise.then(() => {
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                expect(spyOnConnectionStop).not.toBeCalled();
                expect(spyOnUnauthorizedCallback).toBeCalledTimes(1);
                done();
            });
        });
    });

    describe('stop', () => {
        let transport: any;
        let startPromise: Promise<any>;

        beforeEach(() => {
            transport = new SignalrCoreTransport(BASE_URL);
            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.setReceivedCallback(jest.fn());

            transport.updateQuery(
                authprovider.getToken(),
                CONTEXT_ID,
                authprovider.getExpiry(),
            );
            startPromise = transport.start({});

            // resolve handshake request
            mockStart.resolve();

            startPromise.then(() => {
                // start message streaming
                subscribeNextHandler({
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "a": 2 }'),
                });
            });
        });

        it('should close message stream and invoke CloseConnection before closing connection', (done) => {
            startPromise.then(() => {
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_CONNECTED,
                );

                const stopPromise = transport.stop();

                expect(spyOnConnectionStop).not.toBeCalled();

                mockStreamCancel.resolve();

                // send close message before closing connection
                mockStreamCancel.promise.then(() => {
                    expect(spyOnConnectionStop).not.toBeCalled();

                    mockCloseConnection.resolve();
                });

                stopPromise.then(() => {
                    expect(spyOnConnectionStop).toBeCalledTimes(1);

                    tick(10);

                    expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                        3,
                        constants.CONNECTION_STATE_DISCONNECTED,
                    );
                    done();
                });
            });
        });

        it('should close connection even if CloseConnection invocation fails', (done) => {
            startPromise.then(() => {
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_CONNECTED,
                );

                const stopPromise = transport.stop();

                mockStreamCancel.resolve();
                // send close message before closing connection
                mockStreamCancel.promise.then(() => {
                    expect(spyOnConnectionStop).not.toBeCalled();

                    // simuate CloseConnection invocation failure
                    mockCloseConnection.reject();
                });

                stopPromise.then(() => {
                    expect(spyOnConnectionStop).toBeCalledTimes(1);

                    tick(10);

                    expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                        3,
                        constants.CONNECTION_STATE_DISCONNECTED,
                    );
                    done();
                });
            });
        });
    });

    describe('reconnect', () => {
        const messageId = 10;
        let transport: any;
        let startPromise: Promise<any>;
        const spyOnSubscriptionResetCallbak = jest
            .fn()
            .mockName('subscription reset callback on missing message id');

        beforeEach(() => {
            transport = new SignalrCoreTransport(BASE_URL);
            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.setSubscriptionResetCallback(
                spyOnSubscriptionResetCallbak,
            );
            transport.updateQuery(
                authprovider.getToken(),
                CONTEXT_ID,
                authprovider.getExpiry(),
            );
            startPromise = transport.start({}).then(() => {
                // start message streaming
                subscribeNextHandler({
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "a": 2 }'),
                    MessageId: messageId,
                });
            });

            mockStart.resolve();
        });

        it('should set last message id as query string param before trying reconnection', (done) => {
            startPromise.then(() => {
                mockReconnecting();

                expect(mockHubConnection.baseUrl).toBe(
                    `${BASE_URL}/streaming?contextId=${CONTEXT_ID}&messageId=${messageId}`,
                );
                expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                    constants.CONNECTION_STATE_RECONNECTING,
                );

                mockReconnect();
                tick(10);

                const newMessageId = 11;
                subscribeNextHandler({
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "a": 32 }'),
                    MessageId: newMessageId,
                });

                mockReconnecting();

                expect(mockHubConnection.baseUrl).toBe(
                    `${BASE_URL}/streaming?contextId=${CONTEXT_ID}&messageId=${newMessageId}`,
                );

                done();
            });
        });

        it('should call reset all subscriptions if message id is missing', () => {
            mockReconnecting();

            expect(mockHubConnection.baseUrl).toBe(
                `${BASE_URL}/streaming?contextId=${CONTEXT_ID}&messageId=${messageId}`,
            );
            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_RECONNECTING,
            );

            mockReconnect();
            tick(10);

            const newMessageId = 13;
            subscribeNextHandler({
                PayloadFormat: 1,
                Payload: window.btoa('{ "a": 32 }'),
                MessageId: newMessageId,
            });
            expect(spyOnSubscriptionResetCallbak).toBeCalledTimes(1);
        });

        it('should create new message stream on reconnection', () => {
            mockReconnect();
            tick(10);

            expect(spyOnMessageStream).toBeCalledTimes(2);
            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTED,
            );
        });

        it('should renew with new token if token was updated while reconnect response was in flight', () => {
            mockReconnect();

            // token is updated
            transport.updateQuery('NEW_TOKEN', CONTEXT_ID);

            tick(10);

            expect(spyOnMessageStream).toBeCalledTimes(2);
            expect(mockRenewToken).toBeDefined();
        });
    });
});
