import {
    installClock,
    uninstallClock,
    tick,
    getResolvablePromise,
} from '../../../../test/utils';
import mockMathRandom from '../../../../test/mocks/math-random';
import * as constants from '../constants';
import jsonPayload from './payload.json';
import SignalrCoreTransport from './signalr-core-transport';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

const NOOP = () => {};

describe('openapi SignalR core Transport', () => {
    let subscribeNextHandler = NOOP;
    let subscribeErrorHandler = NOOP;

    let mockHubConnection;
    let spyOnMessageStream;
    let spyOnConnectionStop;
    let spyOnStartCallback;
    let spyOnStateChangedCallback;
    let spyOnTransportFailedCallback;
    let mockStart;
    let mockStreamCancel;
    let mockRenewToken;
    let mockConnectionClose;
    let tokenFactory;

    class MockConnectionBuilder {
        withUrl(url, options) {
            tokenFactory = options.accessTokenFactory;

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

    function MockJsonHubProtocol() {
        this.name = 'json';
    }

    window.signalrCore = {
        HubConnectionBuilder: MockConnectionBuilder,
        JsonHubProtocol: MockJsonHubProtocol,
    };

    beforeEach(() => {
        const mockSubject = {
            subscribe: ({ next, error }) => {
                subscribeNextHandler = next;
                subscribeErrorHandler = error;
            },
            cancelCallback: () => {
                mockStreamCancel = getResolvablePromise();
                return mockStreamCancel.promise;
            },
        };
        const closeCallbacks = [];

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
            stream: spyOnMessageStream,
            stop: spyOnConnectionStop,
            invoke: (method, ...args) => {
                if (method === 'RenewToken') {
                    if (args[0] === undefined) {
                        throw Error('Token is required');
                    }

                    mockRenewToken = getResolvablePromise();
                    return mockRenewToken.promise;
                }
            },
            onclose: (callback) => closeCallbacks.push(callback),
        };

        mockConnectionClose = () => {
            closeCallbacks.forEach((callback) => callback());
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
    });

    afterEach(() => {
        uninstallClock();
        subscribeNextHandler = NOOP;
        subscribeErrorHandler = NOOP;
        mockStart = null;
        mockStreamCancel = null;
        mockRenewToken = undefined;
    });

    describe('start', () => {
        let startPromise;
        let transport;

        beforeEach(() => {
            transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );
            transport.setStateChangedCallback(spyOnStateChangedCallback);

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            startPromise = transport.start({}, spyOnStartCallback);
        });

        it('should create message stream and call state change handler upon transport start invocation', (done) => {
            expect(spyOnStartCallback).not.toBeCalled();
            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                1,
                constants.CONNECTION_STATE_CONNECTING,
            );

            // resolve handshake request
            mockStart.resolve();

            startPromise.then(() => {
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_CONNECTED,
                );
                expect(spyOnStartCallback).toBeCalledTimes(1);
                expect(spyOnMessageStream).toBeCalledTimes(1);

                done();
            });
        });

        it('should renew session with new token if token was updated while response was in flight', (done) => {
            expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                1,
                constants.CONNECTION_STATE_CONNECTING,
            );

            // mock token update
            transport.updateQuery('NEW_TOKEN', CONTEXT_ID);

            // resolve handshake request
            mockStart.resolve();

            startPromise.then(() => {
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_CONNECTED,
                );

                expect(mockRenewToken).toBeDefined();
                done();
            });
        });

        it('should call transport fail callback if handshake request fails with valid status code', (done) => {
            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTING,
            );

            // fail handshake request with valid server error
            const error = new Error('Internal server error');
            error.statusCode = 500;
            mockStart.reject(error);

            startPromise.then(() => {
                expect(spyOnStartCallback).not.toBeCalled();
                expect(spyOnStateChangedCallback).toBeCalledTimes(1);
                expect(spyOnTransportFailedCallback).toBeCalledTimes(1);
                done();
            });
        });

        it('should trigger disconnect if error is received while starting message streaming', (done) => {
            // resolve handshake request
            mockStart.resolve();

            startPromise.then(() => {
                subscribeErrorHandler(new Error('Streaming error'));
                tick(10);

                expect(spyOnTransportFailedCallback).toBeCalledTimes(0);
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    3,
                    constants.CONNECTION_STATE_DISCONNECTED,
                );
                done();
            });
        });
    });

    describe('on message received', () => {
        let spyReceivedCallback;
        let startPromise;

        beforeEach(() => {
            spyReceivedCallback = jest.fn().mockName('received callback');
            const transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );
            transport.setReceivedCallback(spyReceivedCallback);

            startPromise = transport.start({});
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
                expect(spyOnTransportFailedCallback).toBeCalledTimes(1);

                mockStreamCancel.resolve();
                mockStreamCancel.promise.then(() => {
                    expect(spyOnConnectionStop).toBeCalledTimes(1);

                    tick(10);
                    expect(spyOnStateChangedCallback).not.toBeCalledWith(
                        constants.CONNECTION_STATE_DISCONNECTED,
                    );
                    done();
                });
            });
        });
    });

    describe('updateQuery', () => {
        it('should renew session on token update', () => {
            const transport = new SignalrCoreTransport(BASE_URL);
            transport.start({});
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID, true);

            expect(mockRenewToken).toBeDefined();
        });
    });

    describe('when renewal call fails', () => {
        let transport;
        let startPromise;
        let spyOnUnauthorizedCallback;

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
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            startPromise = transport.start({});
            mockStart.resolve();
        });

        it('should call disconnect if session is not found', (done) => {
            startPromise
                .then(() => {
                    const renewalPromise = transport.renewSession();
                    mockRenewToken.resolve({ Status: 2 });

                    return renewalPromise;
                })
                .then(() => {
                    mockStreamCancel.resolve();
                    return mockStreamCancel.promise;
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
            startPromise
                .then(() => {
                    const renewalPromise = transport.renewSession();

                    // mock before it calls renewSession again
                    transport.renewSession = jest
                        .fn()
                        .mockName('renew session')
                        .mockImplementation(() => Promise.resolve());

                    mockRenewToken.reject(new Error('Network error'));

                    return renewalPromise;
                })
                .then(() => {
                    expect(transport.renewSession).toBeCalledTimes(1);
                    expect(spyOnConnectionStop).not.toBeCalled();
                    expect(spyOnTransportFailedCallback).not.toBeCalled();
                    done();
                });
        });

        it('should ignore if token is updated before prev response was received', (done) => {
            startPromise
                .then(() => {
                    const renewalPromise = transport.renewSession();

                    transport.updateQuery('NEW_TOKEN', CONTEXT_ID);
                    mockRenewToken.resolve({ Status: 1 });

                    return renewalPromise;
                })
                .then(() => {
                    expect(spyOnTransportFailedCallback).not.toBeCalled();
                    expect(spyOnConnectionStop).not.toBeCalled();
                    done();
                });
        });

        it('should call unauthorized callback', (done) => {
            startPromise
                .then(() => {
                    const renewalPromise = transport.renewSession();

                    mockRenewToken.resolve({ Status: 1 });

                    return renewalPromise;
                })
                .then(() => {
                    expect(spyOnTransportFailedCallback).not.toBeCalled();
                    expect(spyOnConnectionStop).not.toBeCalled();
                    expect(spyOnUnauthorizedCallback).toBeCalledTimes(1);
                    done();
                });
        });
    });

    describe('stop', () => {
        it('should close message stream before closing connection', (done) => {
            const transport = new SignalrCoreTransport(BASE_URL);
            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.setReceivedCallback(jest.fn());

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            const startPromise = transport.start({});

            // resolve handshake request
            mockStart.resolve();

            startPromise.then(() => {
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_CONNECTED,
                );

                // start message streaming
                subscribeNextHandler({
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "a": 2 }'),
                });

                const stopPromise = transport.stop();

                expect(spyOnConnectionStop).not.toBeCalled();

                mockStreamCancel.resolve();

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
        let transport;
        let startPromise;

        beforeEach(() => {
            transport = new SignalrCoreTransport(BASE_URL);
            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            startPromise = transport.start({}).then(() =>
                subscribeNextHandler({
                    PayloadFormat: 1,
                    Payload: window.btoa('{ "a": 2 }'),
                }),
            );

            // resolve handshake request
            mockStart.resolve();
        });

        it('should reconnect on connection close', (done) => {
            startPromise
                .then(() => {
                    expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                        constants.CONNECTION_STATE_CONNECTED,
                    );

                    mockConnectionClose();

                    expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                        constants.CONNECTION_STATE_RECONNECTING,
                    );

                    // flush pending promises
                    tick(10);
                    return new Promise((resolve) => setImmediate(resolve));
                })
                .then(() => {
                    // resolve connection and flush pending promises
                    mockStart.resolve();
                    return new Promise((resolve) => setImmediate(resolve));
                })
                .then(() => {
                    expect(spyOnStateChangedCallback).toHaveBeenLastCalledWith(
                        constants.CONNECTION_STATE_CONNECTED,
                    );
                    done();
                });
        });

        it('should not reconnect on explicit connection close', (done) => {
            startPromise
                .then(() => {
                    // explicitely close connection
                    const stopPromise = transport.stop();
                    mockStreamCancel.resolve();

                    return stopPromise;
                })
                .then(() => {
                    // mock close handler call
                    tick(10);

                    expect(spyOnStateChangedCallback).not.toHaveBeenCalledWith(
                        constants.CONNECTION_STATE_RECONNECTING,
                    );
                    expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                        constants.CONNECTION_STATE_DISCONNECTED,
                    );

                    done();
                });
        });
    });
});
