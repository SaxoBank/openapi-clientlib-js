import {
    installClock,
    uninstallClock,
    tick,
    wait,
} from '../../../../test/utils';
import mockMathRandom from '../../../../test/mocks/math-random';
import mockFetch from '../../../../test/mocks/fetch';
import log from '../../../../log';
import * as RequestUtils from '../../../../utils/request';
import WebSocketTransport from './websocket-transport';
import * as constants from '../constants';
import jsonPayload from './payload.json';
import 'fast-text-encoding';
import type WebsocketTransport from './websocket-transport';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

describe('openapi WebSocket Transport', () => {
    let fetchMock: ReturnType<typeof mockFetch>;
    let authProvider: Record<string, jest.Mock>;
    let spySocketClose: jest.Mock;

    beforeEach(() => {
        spySocketClose = jest.fn().mockName('spySocketClose');

        // @ts-ignore
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
        it('should call start and connection methods upon transport start invocation', async () => {
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const options = {};

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            fetchMock.resolve(200, {});

            await wait();

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: {
                        'X-Request-Id': '1',
                        Authorization: 'TOKEN',
                    },
                }),
            );

            expect(spyOnStartCallback).toBeCalledTimes(1);
            expect(global.WebSocket).toBeCalledTimes(1);
            expect(global.WebSocket).toBeCalledWith(
                'testUrl/streamingws/connect?contextId=0000000000&Authorization=TOKEN&sendHeartbeats=true',
            );
        });

        it('should fallback to other transport if websocket handshake fails', async () => {
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

            await wait();

            expect(spyOnStartCallback).toBeCalledTimes(1);
            expect(global.WebSocket).toBeCalledWith(
                'testUrl/streamingws/connect?contextId=0000000000&Authorization=TOKEN&sendHeartbeats=true',
            );

            // simulate handshake failure by not calling onopen first
            // @ts-expect-error
            transport.socket.onclose({ code: 1006 });

            expect(spyOnFailCallback).toBeCalledTimes(1);
            expect(spySocketClose).toBeCalledTimes(1);
        });
    });

    describe('updateQuery', () => {
        it('should update connection qs with new authorization token and context id', () => {
            const transport = new WebSocketTransport(BASE_URL);

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            expect(transport.getQuery()).toBe(
                '?contextId=0000000000&Authorization=TOKEN&sendHeartbeats=true',
            );
        });

        it('should cope with a token update after start', async () => {
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const options = {};

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            const rejectFirst = fetchMock.reject;
            transport.updateQuery(AUTH_TOKEN + '2', CONTEXT_ID + '2', 0, true);

            rejectFirst(new Error());
            fetchMock.resolve(200, {});

            await wait();
            tick(300);
            await wait();

            expect(fetchMock).toBeCalledTimes(2);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=00000000002',
                expect.objectContaining({
                    headers: {
                        'X-Request-Id': '2',
                        Authorization: 'TOKEN2',
                    },
                }),
            );

            expect(spyOnStartCallback).toBeCalledTimes(1);
            expect(global.WebSocket).toBeCalledTimes(1);
            expect(global.WebSocket).toBeCalledWith(
                'testUrl/streamingws/connect?contextId=00000000002&Authorization=TOKEN2&sendHeartbeats=true',
            );
        });
    });

    describe('network errors', () => {
        it('should retry authorization when it gets a network error', async () => {
            const options = {};
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: { 'X-Request-Id': '1', Authorization: 'TOKEN' },
                }),
            );
            fetchMock.mockClear();

            fetchMock.reject(new Error('network error'));

            await wait();

            tick(300);
            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: {
                        'X-Request-Id': '2',
                        Authorization: 'TOKEN',
                    },
                }),
            );
            fetchMock.resolve(200, {});

            await wait();

            expect(spyOnStartCallback).toBeCalledTimes(1);
        });

        it('should not retry authorization when it gets a network error and while waiting to retry it gets called again', async () => {
            const options = {};
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);

            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: { 'X-Request-Id': '1', Authorization: 'TOKEN' },
                }),
            );
            fetchMock.resolve(200, {});
            fetchMock.mockClear();

            await wait();

            expect(spyOnStartCallback).toBeCalledTimes(1);
            transport.updateQuery('NEW_TOKEN', CONTEXT_ID, 100, true);

            fetchMock.reject(new Error('network error'));
            fetchMock.mockClear();

            await wait();

            tick(150);
            transport.updateQuery('ANOTHER_NEW_TOKEN', CONTEXT_ID, 100, true);
            tick(150);
            expect(fetchMock).toBeCalledTimes(1);
            expect(fetchMock).toBeCalledWith(
                'testUrl/streamingws/authorize?contextId=0000000000',
                expect.objectContaining({
                    headers: {
                        'X-Request-Id': '3', // 1 to start, 2 for NEW_TOKEN, 3 for the next new token
                        Authorization: 'ANOTHER_NEW_TOKEN',
                    },
                }),
            );
            fetchMock.resolve(200, {});

            await wait();
            expect(fetchMock).toBeCalledTimes(1);
        });

        it('should reconnect immediately and then after initial time, after 2000ms', async () => {
            const transport = new WebSocketTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({}, () => {});
            fetchMock.resolve(200, {});

            await wait();

            expect(global.WebSocket).toBeCalledTimes(1);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1; // WebSocket internal state equal open
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket?.onopen();

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 3; // WebSocket internal state equal closed
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket?.onclose({ code: 1001 });

            // assert we retry immediately
            expect(global.WebSocket).toBeCalledTimes(2);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 3; // WebSocket internal state equal closed

            transport.socket?.onclose?.({ code: 1001 } as any);

            // assert we do not retry immediately
            expect(global.WebSocket).toBeCalledTimes(2);

            tick(1000);

            // after 1s we still haven't retried
            expect(global.WebSocket).toBeCalledTimes(2);

            tick(1000);

            // after 2s - now we retry
            expect(global.WebSocket).toBeCalledTimes(3);
        });

        it.each([
            [5001, 0, true],
            [2000, 3001, true],
            [0, 0, false],
            [4000, 500, false],
        ])(
            'should reconnect if it looks like we are not connected any more - %d,% d',
            async (
                timeAfterMsg: number,
                timeAfterOrphanFound: number,
                shouldReconnect: boolean,
            ) => {
                const options = {};
                const spyOnStartCallback = jest
                    .fn()
                    .mockName('spyStartCallback');

                const transport = new WebSocketTransport(BASE_URL);
                transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
                transport.start(options, spyOnStartCallback);
                fetchMock.resolve(200, {});

                await wait();
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

                transport.socket?.onmessage?.({
                    data: payload.buffer,
                } as any);

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
            },
        );
    });

    describe('received', () => {
        it('should call received callback upon websocket received being called', async () => {
            const spyOnReceivedCallback = jest
                .fn()
                .mockName('spyReceivedCallback');
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            const transport = new WebSocketTransport(BASE_URL);
            transport.setReceivedCallback(spyOnReceivedCallback);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({}, spyOnStartCallback);
            fetchMock.resolve(200, {});

            await wait();

            expect(transport.socket?.onmessage).not.toBeNull();

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

            transport.socket?.onmessage?.({ data: payload.buffer } as any);
            expect(spyOnReceivedCallback).toBeCalledTimes(1);
            expect(spyOnReceivedCallback).toBeCalledWith([
                {
                    Data: jsonPayload,
                    DataFormat: 0,
                    ReferenceId: '8',
                    ReservedField: 0,
                },
            ]);
        });

        it('should call fail callback if ill formatted json is received', async () => {
            const spyOnFailCallback = jest.fn().mockName('spyOnFailCallback');

            const transport = new WebSocketTransport(
                BASE_URL,
                spyOnFailCallback,
            );

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start();
            fetchMock.resolve(200, {});

            await wait();

            expect(transport.socket?.onmessage).not.toBeNull();
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

            transport.socket?.onmessage?.({ data: payload.buffer } as any);
            expect(spyOnFailCallback).toBeCalledTimes(1);
        });

        describe('incremental message id', () => {
            it('should log error if received websocket messages are not in incremental id fashion', async () => {
                const logSpy = jest.spyOn(log, 'error');

                const spyOnReceivedCallback = jest
                    .fn()
                    .mockName('spyReceivedCallback');
                const spyOnStartCallback = jest
                    .fn()
                    .mockName('spyStartCallback');

                const transport = new WebSocketTransport(BASE_URL);
                transport.setReceivedCallback(spyOnReceivedCallback);
                transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
                transport.start({}, spyOnStartCallback);
                fetchMock.resolve(200, {});

                await wait();

                const dataBuffer = new window.TextEncoder().encode(
                    JSON.stringify(jsonPayload),
                );
                const payload = new Uint8Array(
                    new ArrayBuffer(dataBuffer.length + 17),
                );
                payload.set(
                    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 134, 12, 0, 0],
                    0,
                );
                payload.set(dataBuffer, 17);
                transport.socket?.onmessage?.({
                    data: payload.buffer,
                } as any);

                // send another message with same id i.e. 1
                transport.socket?.onmessage?.({
                    data: payload.buffer,
                } as any);

                expect(logSpy).toBeCalledWith(
                    'PlainWebSocketsTransport',
                    'Messages out of order in websocket transport',
                    { lastMessageId: 1, messageId: 1 },
                );
            });

            it('should skip _connectionheartbeat control message from incremental id logic', async () => {
                const logSpy = jest.spyOn(log, 'error');
                const spyOnReceivedCallback = jest
                    .fn()
                    .mockName('spyReceivedCallback');
                const spyOnStartCallback = jest
                    .fn()
                    .mockName('spyStartCallback');

                const transport = new WebSocketTransport(BASE_URL);
                transport.setReceivedCallback(spyOnReceivedCallback);
                transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
                transport.start({}, spyOnStartCallback);
                fetchMock.resolve(200, {});

                await wait();

                const dataBuffer = new window.TextEncoder().encode(
                    JSON.stringify(jsonPayload),
                );
                const payload = new Uint8Array(
                    new ArrayBuffer(dataBuffer.length + 17),
                );

                /*
                     [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 134, 12, 0, 0] is parsed as:
                     messageIdBuffer (first 8 bytes): 1, 0, 0, 0, 0, 0, 0, 0,
                     reservedField (2 bytes): 0, 0,
                     referenceIdSize (1 byte): 1,
                     referenceIdBuffer (n bytes make up the reference id whose value is ASCII string): 56,
                     dataFormat (1 byte, 0 for JSON):0,
                     payloadSize(n bytes make up the actual payload): 134, 12, 0, 0, // since databuffer length is 3206
                    */
                payload.set(
                    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 134, 12, 0, 0],
                    0,
                );
                payload.set(dataBuffer, 17);
                transport.socket?.onmessage?.({
                    data: payload.buffer,
                } as any);

                // send _connectionheartbeat control message with same id i.e. 1
                const dataBuffer2 = new window.TextEncoder().encode(
                    JSON.stringify([{ ReferenceId: '_connectionheartbeat' }]),
                );
                const payload2 = new Uint8Array(
                    new ArrayBuffer(dataBuffer2.length + 17),
                );

                /*
                     payloadSize(n bytes make up the actual payload): 40, 0, 0, 0, // since databuffer length is 40
                    */
                payload2.set(
                    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 56, 0, 40, 0, 0, 0],
                    0,
                );
                payload2.set(dataBuffer2, 17);
                transport.socket?.onmessage?.({
                    data: payload2.buffer,
                } as any);

                expect(logSpy).toBeCalledTimes(0);
            });
        });
    });

    describe('connection states', () => {
        let transport: WebsocketTransport;
        let stateChangedSpy: jest.Mock;
        let spyOnStartCallback;
        let spyOnunauthorizedCallback: jest.Mock;

        function givenTransport(options?: any) {
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

        it('should call stateChanged callback with connecting state when internal state changed to connecting', async () => {
            givenTransport();

            await wait();
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                constants.CONNECTION_STATE_CONNECTING,
            ]);
        });

        it('should call stateChanged callback with connected state when internal state changed to connected', async () => {
            givenTransport();

            await wait();
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                constants.CONNECTION_STATE_CONNECTING,
            ]);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1; // WebSocket internal state equal open
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket.onopen();

            expect(stateChangedSpy.mock.calls.length).toEqual(2);
            expect(stateChangedSpy.mock.calls[1]).toEqual([
                constants.CONNECTION_STATE_CONNECTED,
            ]);
        });

        it('should call stateChanged callback with reconnecting state when internal state changed to reconnect', async () => {
            givenTransport();

            await wait();

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                constants.CONNECTION_STATE_CONNECTING,
            ]);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1; // WebSocket internal state equal open

            transport.socket?.onopen?.({} as any);

            expect(stateChangedSpy.mock.calls.length).toEqual(2);
            expect(stateChangedSpy.mock.calls[1]).toEqual([
                constants.CONNECTION_STATE_CONNECTED,
            ]);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 3; // WebSocket internal state equal closed
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket.onclose({ code: 1001 });

            expect(stateChangedSpy.mock.calls[2]).toEqual([
                constants.CONNECTION_STATE_RECONNECTING,
            ]);

            tick(2000);
        });

        it('should reconnect with a new authorization when it gets a possible 401', async () => {
            givenTransport();

            await wait();

            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([
                constants.CONNECTION_STATE_CONNECTING,
            ]);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1; // WebSocket internal state equal open

            transport.socket?.onopen?.({} as any);

            expect(stateChangedSpy.mock.calls.length).toEqual(2);
            expect(stateChangedSpy.mock.calls[1]).toEqual([
                constants.CONNECTION_STATE_CONNECTED,
            ]);

            // @ts-expect-error its a readonly property
            transport.socket.readyState = 3; // WebSocket internal state equal closed

            transport.socket?.onclose?.({ code: 1002 } as any);

            expect(spyOnunauthorizedCallback).toBeCalledTimes(1);

            // simulate token update
            const authExpiry = Date.now() + 1000;
            transport.updateQuery('NEW-TOKEN', CONTEXT_ID, authExpiry, true);
            fetchMock.resolve(200, {});

            // should re-cpnnect after authorization
            await wait();
            expect(stateChangedSpy.mock.calls[2]).toEqual([
                constants.CONNECTION_STATE_RECONNECTING,
            ]);

            expect(global.WebSocket).toBeCalledWith(
                'testUrl/streamingws/connect?contextId=0000000000&Authorization=NEW-TOKEN&sendHeartbeats=true',
            );
        });
    });

    describe('websocket inactivity finder', () => {
        it('start and stop should work correctly', async () => {
            const transport = new WebSocketTransport(BASE_URL, undefined);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({ isWebsocketStreamingHeartBeatEnabled: true });
            fetchMock.resolve(200, {});

            await wait();

            // on ws open should start
            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1; // WebSocket internal state equal open
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket.onopen();

            expect(transport.inactivityFinderRunning).toBe(true);
            expect(transport.inactivityFinderNextUpdateTimeoutId).not.toBe(
                null,
            );

            // on ws close should stop
            // @ts-expect-error its a readonly property
            transport.socket.readyState = 3; // WebSocket internal state equal closed
            // @ts-expect-error
            transport.socket.onclose({ code: 1001 });

            expect(transport.inactivityFinderRunning).toBe(false);
            expect(transport.inactivityFinderNextUpdateTimeoutId).toBe(null);
        });

        it('should reconnect if connection is established and there is no message since 3 seconds', async () => {
            const stateChangedSpy: jest.Mock = jest
                .fn()
                .mockName('stateChanged');
            const transport = new WebSocketTransport(BASE_URL, undefined);
            transport.setStateChangedCallback(stateChangedSpy);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({
                isWebsocketStreamingHeartBeatEnabled: true,
            });
            fetchMock.resolve(200, {});

            await wait();

            expect(global.WebSocket).toBeCalledTimes(1);
            // @ts-expect-error its a readonly property
            transport.socket.readyState = 1;
            // @ts-ignore referring to socket method instead of WebSocketTransport
            transport.socket.onopen();

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
            transport.socket?.onmessage?.({ data: payload.buffer } as any);
            expect(stateChangedSpy.mock.calls[1]).toEqual([
                constants.CONNECTION_STATE_CONNECTED,
            ]);
            tick(3001);
            expect(stateChangedSpy.mock.calls[2]).toEqual([
                constants.CONNECTION_STATE_RECONNECTING,
            ]);
        });
    });
});
