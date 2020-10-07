import { installClock, uninstallClock, tick } from '../../../../test/utils';
import '../../../../test/mocks/math-random';
import mockFetch from '../../../../test/mocks/fetch';
import * as constants from './../constants';
import jsonPayload from './payload.json';
import SignalrCoreTransport from './signalr-core-transport';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

const NOOP = () => {};

describe('openapi SignalR core Transport', () => {
    let subscribeNextHandler = NOOP;
    let subscribeErrorHandler = NOOP;
    let startPromiseResolver = NOOP;
    let startPromiseRejector = NOOP;
    let streamCancelPromiseResolver = NOOP;

    let mockHubConnection;
    let spyOnMessageStream;
    let spyOnConnectionStop;
    let spyOnStartCallback;
    let spyOnStateChangedCallback;
    let spyOnTransportFailedCallback;
    let streamCancelPromise;
    let fetchMock;

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
                streamCancelPromise = new Promise((resolve) => {
                    streamCancelPromiseResolver = resolve;
                });

                return streamCancelPromise;
            },
        };
        const closeCallbacks = [];

        spyOnMessageStream = jest
            .fn()
            .mockName('spyOnMessageStream')
            .mockImplementation(() => mockSubject);

        spyOnConnectionStop = jest
            .fn()
            .mockName('spyOnConnectionStop')
            .mockImplementation(() =>
                setTimeout(() =>
                    closeCallbacks.forEach((callback) => callback()),
                ),
            );

        mockHubConnection = {
            start: () =>
                new Promise((resolve, reject) => {
                    startPromiseResolver = resolve;
                    startPromiseRejector = reject;
                }),
            stream: spyOnMessageStream,
            stop: spyOnConnectionStop,
            onclose: (callback) => closeCallbacks.push(callback),
            onreconnecting: () => {},
            onreconnected: () => {},
        };

        fetchMock = mockFetch();
        installClock();

        spyOnStartCallback = jest.fn().mockName('spyStartCallback');
        spyOnStateChangedCallback = jest
            .fn()
            .mockName('spyStateChangedCallback');
        spyOnTransportFailedCallback = jest.fn().mockName('transportFailed');
    });

    afterEach(() => {
        uninstallClock();
        subscribeNextHandler = NOOP;
        subscribeErrorHandler = NOOP;
        startPromiseResolver = NOOP;
        startPromiseRejector = NOOP;
        streamCancelPromiseResolver = NOOP;
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
            startPromiseResolver();

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
            startPromiseRejector(error);

            startPromise.then(() => {
                expect(spyOnStartCallback).not.toBeCalled();
                expect(spyOnStateChangedCallback).toBeCalledTimes(1);
                expect(spyOnTransportFailedCallback).toBeCalledTimes(1);
                done();
            });
        });

        it('should not call transport fail callback if handshake request fails due to network error', (done) => {
            expect(spyOnStateChangedCallback).toHaveBeenCalledWith(
                constants.CONNECTION_STATE_CONNECTING,
            );

            // fail handshake request with network error
            const error = new Error();
            error.statusCode = 0;
            startPromiseRejector(error);

            startPromise.then(() => {
                expect(spyOnStartCallback).not.toBeCalled();
                expect(spyOnStateChangedCallback).toHaveBeenNthCalledWith(
                    2,
                    constants.CONNECTION_STATE_DISCONNECTED,
                );
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                done();
            });
        });

        it('should trigger disconnect if error is received while starting message streaming', (done) => {
            // resolve handshake request
            startPromiseResolver();

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
            spyReceivedCallback = jest.fn().mockName('spyReceivedCallback');
            const transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );
            transport.setReceivedCallback(spyReceivedCallback);

            startPromise = transport.start({});
            startPromiseResolver();
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

                streamCancelPromiseResolver();
                streamCancelPromise.then(() => {
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
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID, true);

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streaming/renewal/renewsession',
                expect.objectContaining({
                    headers: { Authorization: 'TOKEN' },
                }),
            );
        });
    });

    describe('when renewal call fails', () => {
        let transport;
        let renewalPromise;

        beforeEach(() => {
            transport = new SignalrCoreTransport(
                BASE_URL,
                spyOnTransportFailedCallback,
            );

            // update instance variables
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({});

            renewalPromise = transport.renewSession(
                AUTH_TOKEN,
                CONTEXT_ID,
                true,
            );

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streaming/renewal/renewsession',
                expect.objectContaining({
                    headers: { Authorization: 'TOKEN' },
                }),
            );
        });

        it('should call transport fail callback ', (done) => {
            fetchMock.resolve('404');

            renewalPromise.then(() => {
                expect(spyOnTransportFailedCallback).toBeCalled();
                expect(spyOnConnectionStop).toBeCalled();

                tick(10);
                expect(spyOnStateChangedCallback).not.toBeCalledWith(
                    constants.CONNECTION_STATE_DISCONNECTED,
                );
                done();
            });
        });

        it('should retry renewal if there is a network error', (done) => {
            // mock before it calls renewSession again
            transport.renewSession = jest
                .fn()
                .mockName('spyOnRenewSession')
                .mockImplementation(() => Promise.resolve());

            fetchMock.reject(new Error('Network error'));

            renewalPromise.then(() => {
                expect(transport.renewSession).toBeCalledTimes(1);
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                done();
            });
        });

        it('should ignore if token is updated before prev response was received', (done) => {
            transport.updateQuery('NEW_TOKEN', CONTEXT_ID);
            fetchMock.resolve('401');

            renewalPromise.then(() => {
                expect(spyOnTransportFailedCallback).not.toBeCalled();
                done();
            });
        });
    });

    describe('stop', () => {
        it.only('should close message stream before closing connection', (done) => {
            const transport = new SignalrCoreTransport(BASE_URL);
            transport.setStateChangedCallback(spyOnStateChangedCallback);
            transport.setReceivedCallback(jest.fn());

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            const startPromise = transport.start({});

            // resolve handshake request
            startPromiseResolver();

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

                streamCancelPromiseResolver();

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
