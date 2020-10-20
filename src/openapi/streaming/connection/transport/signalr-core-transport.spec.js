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
            onreconnecting: () => {},
            onreconnected: () => {},
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
    });

    describe('start', () => {
        let startPromise;

        beforeEach(() => {
            const transport = new SignalrCoreTransport(
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
        let renewalPromise;
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
            transport.start({});

            renewalPromise = transport.renewSession();
        });

        it('should call disconnect if session is not found', (done) => {
            expect(mockRenewToken).toBeDefined();

            mockRenewToken.resolve({ Status: 2 });

            renewalPromise.then(() => {
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
            expect(mockRenewToken).toBeDefined();

            // mock before it calls renewSession again
            transport.renewSession = jest
                .fn()
                .mockName('renew session')
                .mockImplementation(() => Promise.resolve());

            mockRenewToken.reject(new Error('Network error'));

            renewalPromise.then(() => {
                expect(transport.renewSession).toBeCalledTimes(1);
                expect(spyOnConnectionStop).not.toBeCalled();
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                done();
            });
        });

        it('should ignore if token is updated before prev response was received', (done) => {
            expect(mockRenewToken).toBeDefined();

            transport.updateQuery('NEW_TOKEN', CONTEXT_ID);
            mockRenewToken.resolve({ Status: 1 });

            renewalPromise.then(() => {
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                expect(spyOnConnectionStop).not.toBeCalled();
                done();
            });
        });

        it('should call unauthorized callback', (done) => {
            expect(mockRenewToken).toBeDefined();

            mockRenewToken.resolve({ Status: 1 });

            renewalPromise.then(() => {
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
});
