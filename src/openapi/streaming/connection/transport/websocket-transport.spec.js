import {
    installClock,
    uninstallClock,
    tick,
    setTimeout,
} from '../../../../test/utils';
import mockMathRandom from '../../../../test/mocks/math-random';
import mockFetch from '../../../../test/mocks/fetch';
import * as RequestUtils from '../../../../utils/request';
import WebSocketTransport from './websocket-transport';
import * as constants from './../constants';
import jsonPayload from './payload.json';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

describe('openapi WebSocket Transport', () => {
    let fetchMock;
    let authProvider;
    let spySocketClose;

    beforeEach(() => {
        spySocketClose = jest.fn().mockName('spySocketClose');

        global.WebSocket = jest.fn().mockImplementation(() => {
            return {
                close: spySocketClose,
            };
        });

        fetchMock = mockFetch();
        authProvider = {
            getToken: jest.fn(),
            on: jest.fn(),
        };
        authProvider.getToken.mockImplementation(() => 'TOKEN');

        RequestUtils.resetCounter();

        installClock();
        mockMathRandom();
    });
    afterEach(() => uninstallClock());

    describe('start', () => {
        it('should call start and connection methods upon transport start invocation', (done) => {
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const options = {};

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            fetchMock.resolve(200, {});

            transport.authorizePromise.then(() => {
                expect(fetchMock).toBeCalledTimes(1);
                expect(fetchMock).toBeCalledWith(
                    'testUrl/streamingws/authorize?contextId=0000000000',
                    expect.objectContaining({
                        headers: { 'X-Request-Id': 1, Authorization: 'TOKEN' },
                    }),
                );

                expect(spyOnStartCallback).toBeCalledTimes(1);
                expect(global.WebSocket).toBeCalledTimes(1);
                expect(global.WebSocket).toBeCalledWith(
                    'testUrl/streamingws/connect?contextId=0000000000&Authorization=TOKEN',
                );

                done();
            });
        });

        it('should fallback to other transport if websocket handshake fails', (done) => {
            const options = {};
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const spyOnFailCallback = jest.fn().mockName('spyFailCallback');

            const transport = new WebSocketTransport(
                BASE_URL,
                spyOnFailCallback,
            );
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            fetchMock.resolve(200, {});

            transport.authorizePromise.then(() => {
                expect(spyOnStartCallback).toBeCalledTimes(1);
                expect(global.WebSocket).toBeCalledWith(
                    'testUrl/streamingws/connect?contextId=0000000000&Authorization=TOKEN',
                );

                // simulate handshake failure by not calling onopen first
                transport.socket.onclose({ code: 1006 });

                expect(spyOnFailCallback).toBeCalledTimes(1);
                expect(spySocketClose).toBeCalledTimes(1);
                done();
            });
        });
    });

    describe('updateQuery', () => {
        it('should update connection qs with new authorization token and context id', () => {
            const transport = new WebSocketTransport(BASE_URL);

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            expect(transport.getQuery()).toBe(
                '?contextId=0000000000&Authorization=TOKEN',
            );
        });
    });

    describe('network errors', () => {
        it('should retry authorization when it gets a network error', (done) => {
            const options = {};
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: { 'X-Request-Id': 1, Authorization: 'TOKEN' },
                }),
            );
            fetchMock.mockClear();

            fetchMock.reject(new Error('network error'));
            tick(1);

            setTimeout(() => {
                expect(fetchMock).toBeCalledTimes(1);
                expect(fetchMock).toBeCalledWith(
                    'testUrl/streamingws/authorize?contextId=0000000000',
                    expect.objectContaining({
                        headers: { 'X-Request-Id': 2, Authorization: 'TOKEN' },
                    }),
                );
                fetchMock.resolve(200, {});

                setTimeout(() => {
                    expect(spyOnStartCallback).toBeCalledTimes(1);

                    done();
                });
            });
        });

        it('should reconnect immediately and then after initial time, after 2000ms', (done) => {
            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({}, () => {});
            fetchMock.resolve(200, {});

            transport.authorizePromise.then(() => {
                expect(global.WebSocket).toBeCalledTimes(1);

                transport.socket.readyState = 1; // WebSocket internal state equal open
                transport.socket.onopen();

                transport.socket.readyState = 3; // WebSocket internal state equal closed
                transport.socket.onclose({ code: 1001 });

                // assert we retry immediately
                expect(global.WebSocket).toBeCalledTimes(2);

                transport.socket.readyState = 3; // WebSocket internal state equal closed
                transport.socket.onclose({ code: 1001 });

                // assert we do not retry immediately
                expect(global.WebSocket).toBeCalledTimes(2);

                tick(1000);

                // after 1s we still haven't retried
                expect(global.WebSocket).toBeCalledTimes(2);

                tick(1000);

                // after 2s - now we retry
                expect(global.WebSocket).toBeCalledTimes(3);

                done();
            });
        });

        it.each([
            [5001, 0, true],
            [2000, 3001, true],
            [0, 0, false],
            [4000, 500, false],
        ])(
            'should reconnect if it looks like we are not connected any more - %d,% d',
            (timeAfterMsg, timeAfterOrphanFound, shouldReconnect, done) => {
                const options = {};
                const spyOnStartCallback = jest
                    .fn()
                    .mockName('spyStartCallback');

                const transport = new WebSocketTransport(BASE_URL);
                transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
                transport.start(options, spyOnStartCallback);
                fetchMock.resolve(200, {});

                setTimeout(() => {
                    const originalSocket = transport.socket;

                    // we get data
                    const dataBuffer = new window.TextEncoder().encode(
                        JSON.stringify(jsonPayload),
                    );
                    const payload = new Uint8Array(
                        new ArrayBuffer(dataBuffer.length + 17),
                    );
                    payload.set(
                        [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 134, 12, 0, 0],
                        0,
                    );
                    payload.set(dataBuffer, 17);

                    transport.socket.onmessage({ data: payload.buffer });

                    // but now its disconnected.. 5 seconds pass
                    tick(timeAfterMsg);

                    // a orphan is found
                    transport.onOrphanFound();

                    tick(timeAfterOrphanFound);

                    expect(transport.socket).toBe(originalSocket);

                    transport.onSubscribeNetworkError();

                    if (shouldReconnect) {
                        expect(transport.socket).not.toBe(originalSocket);
                        expect(transport.socket).not.toBeNull();
                    } else {
                        expect(transport.socket).toBe(originalSocket);
                    }

                    done();
                });
            },
        );
    });

    describe('received', () => {
        it('should call received callback upon websocket received being called', (done) => {
            const spyOnReceivedCallback = jest
                .fn()
                .mockName('spyReceivedCallback');
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            const transport = new WebSocketTransport(BASE_URL);
            transport.setReceivedCallback(spyOnReceivedCallback);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({}, spyOnStartCallback);
            fetchMock.resolve(200, {});

            transport.authorizePromise.then(() => {
                expect(transport.socket.onmessage).not.toBeNull();

                const dataBuffer = new window.TextEncoder().encode(
                    JSON.stringify(jsonPayload),
                );
                const payload = new Uint8Array(
                    new ArrayBuffer(dataBuffer.length + 17),
                );
                payload.set(
                    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 134, 12, 0, 0],
                    0,
                );
                payload.set(dataBuffer, 17);

                transport.socket.onmessage({ data: payload.buffer });
                expect(spyOnReceivedCallback).toBeCalledTimes(1);
                expect(spyOnReceivedCallback).toBeCalledWith([
                    {
                        Data: jsonPayload,
                        DataFormat: 0,
                        ReferenceId: '8',
                        ReservedField: 0,
                    },
                ]);
                done();
            });
        });

        it('should call fail callback if ill formatted json is received', (done) => {
            const spyOnFailCallback = jest.fn().mockName('spyOnFailCallback');

            const transport = new WebSocketTransport(
                BASE_URL,
                spyOnFailCallback,
            );

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start();
            fetchMock.resolve(200, {});

            transport.authorizePromise.then(() => {
                expect(transport.socket.onmessage).not.toBeNull();
                const illFormattedJson = '{some-key:123';
                const dataBuffer = Uint8Array.from(illFormattedJson, (c) =>
                    c.charCodeAt(0),
                );
                const payload = new Uint8Array(
                    new ArrayBuffer(dataBuffer.length + 17),
                );
                payload.set(
                    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 13, 0, 0, 0],
                    0,
                );
                payload.set(dataBuffer, 17);

                transport.socket.onmessage({ data: payload.buffer });
                expect(spyOnFailCallback).toBeCalledTimes(1);

                done();
            });
        });
    });

    describe('connection states', () => {
        let transport;
        let stateChangedSpy;
        let spyOnStartCallback;
        let spyOnunauthorizedCallback;

        function givenTransport(options) {
            spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            fetchMock.resolve(200, {});

            stateChangedSpy = jest.fn().mockName('stateChanged');
            transport.setStateChangedCallback(stateChangedSpy);

            spyOnunauthorizedCallback = jest
                .fn()
                .mockName('spyunauthorizedCallback');
            transport.setUnauthorizedCallback(spyOnunauthorizedCallback);
            return transport;
        }

        it('should call stateChanged callback with connecting state when internal state changed to connecting', (done) => {
            givenTransport();

            transport.authorizePromise.then(() => {
                expect(stateChangedSpy.mock.calls.length).toEqual(1);
                expect(stateChangedSpy.mock.calls[0]).toEqual([
                    constants.CONNECTION_STATE_CONNECTING,
                ]);
                done();
            });
        });

        it('should call stateChanged callback with connected state when internal state changed to connected', (done) => {
            givenTransport();

            transport.authorizePromise.then(() => {
                expect(stateChangedSpy.mock.calls.length).toEqual(1);
                expect(stateChangedSpy.mock.calls[0]).toEqual([
                    constants.CONNECTION_STATE_CONNECTING,
                ]);

                transport.socket.readyState = 1; // WebSocket internal state equal open
                transport.socket.onopen();

                expect(stateChangedSpy.mock.calls.length).toEqual(2);
                expect(stateChangedSpy.mock.calls[1]).toEqual([
                    constants.CONNECTION_STATE_CONNECTED,
                ]);

                done();
            });
        });

        it('should call stateChanged callback with reconnecting state when internal state changed to reconnect', (done) => {
            givenTransport();

            const initialPromise = transport.authorizePromise;
            transport.authorizePromise.then(() => {
                expect(stateChangedSpy.mock.calls.length).toEqual(1);
                expect(stateChangedSpy.mock.calls[0]).toEqual([
                    constants.CONNECTION_STATE_CONNECTING,
                ]);

                transport.socket.readyState = 1; // WebSocket internal state equal open
                transport.socket.onopen();

                expect(stateChangedSpy.mock.calls.length).toEqual(2);
                expect(stateChangedSpy.mock.calls[1]).toEqual([
                    constants.CONNECTION_STATE_CONNECTED,
                ]);

                transport.socket.readyState = 3; // WebSocket internal state equal closed
                transport.socket.onclose({ code: 1001 });

                expect(stateChangedSpy.mock.calls[2]).toEqual([
                    constants.CONNECTION_STATE_RECONNECTING,
                ]);

                tick(2000);

                expect(
                    transport.authorizePromise === initialPromise,
                ).toBeTruthy();
                done();
            });
        });

        it('should reconnect with a new authorization when it gets a possible 401', (done) => {
            givenTransport();

            transport.authorizePromise.then(() => {
                expect(stateChangedSpy.mock.calls.length).toEqual(1);
                expect(stateChangedSpy.mock.calls[0]).toEqual([
                    constants.CONNECTION_STATE_CONNECTING,
                ]);

                transport.socket.readyState = 1; // WebSocket internal state equal open
                transport.socket.onopen();

                expect(stateChangedSpy.mock.calls.length).toEqual(2);
                expect(stateChangedSpy.mock.calls[1]).toEqual([
                    constants.CONNECTION_STATE_CONNECTED,
                ]);

                transport.socket.readyState = 3; // WebSocket internal state equal closed
                transport.socket.onclose({ code: 1002 });

                expect(spyOnunauthorizedCallback).toBeCalledTimes(1);

                // simulate token update
                const authExpiry = Date.now() + 1000;
                transport.updateQuery(
                    'NEW-TOKEN',
                    CONTEXT_ID,
                    authExpiry,
                    true,
                );
                fetchMock.resolve(200, {});

                // should re-cpnnect after authorization
                transport.authorizePromise.then(() => {
                    expect(stateChangedSpy.mock.calls[2]).toEqual([
                        constants.CONNECTION_STATE_RECONNECTING,
                    ]);

                    expect(global.WebSocket).toBeCalledWith(
                        'testUrl/streamingws/connect?contextId=0000000000&Authorization=NEW-TOKEN',
                    );

                    done();
                });
            });
        });
    });
});
