import { installClock, uninstallClock, tick } from '../../../../test/utils';
import mockTransport from '../../../../test/mocks/transport';
import '../../../../test/mocks/math-random';
import WebSocketTransport from './websocket-transport';
import * as constants from './../constants';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

describe('openapi WebSocket Transport', () => {
    let restTransportMock;
    let authProvider;

    beforeEach(() => {
        global.WebSocket = jest.fn().mockImplementation(() => {
            return {
                close: jest.fn(),
            };
        });

        restTransportMock = mockTransport();
        authProvider = {
            getToken: jest.fn(),
            on: jest.fn(),
        };
        authProvider.getToken.mockImplementation(() => 'TOKEN');

        installClock();
    });
    afterEach(() => uninstallClock());

    describe('start', () => {
        it('should call start and connection methods upon transport start invocation', (done) => {
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const options = {};

            restTransportMock.put.mockImplementation(() =>
                Promise.resolve({ data: [] }),
            );

            const transport = new WebSocketTransport(
                BASE_URL,
                restTransportMock,
            );
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);

            transport.authorizePromise.then(() => {
                expect(restTransportMock.put).toBeCalledTimes(1);
                expect(restTransportMock.put).toBeCalledWith(
                    'streamingws',
                    'authorize?contextId=0000000000',
                );

                expect(spyOnStartCallback).toBeCalledTimes(1);
                expect(global.WebSocket).toBeCalledTimes(1);
                expect(global.WebSocket).toBeCalledWith(
                    'testUrl/streamingws/connect?contextId=0000000000&Authorization=TOKEN',
                );

                done();
            });
        });
    });

    describe('updateQuery', () => {
        it('should update connection qs with new authorization token and context id', () => {
            const transport = new WebSocketTransport(
                BASE_URL,
                restTransportMock,
            );

            restTransportMock.put.mockImplementation(() =>
                Promise.resolve({ data: [] }),
            );

            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID, true);
            expect(transport.getQuery()).toBe(
                '?contextId=0000000000&Authorization=TOKEN',
            );
        });
    });

    describe('received', () => {
        it('should call received callback upon websocket received being called', (done) => {
            const spyOnReceivedCallback = jest
                .fn()
                .mockName('spyReceivedCallback');
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');

            restTransportMock.put.mockImplementation(() =>
                Promise.resolve({ data: [] }),
            );

            const transport = new WebSocketTransport(
                BASE_URL,
                restTransportMock,
            );
            transport.setReceivedCallback(spyOnReceivedCallback);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start({}, spyOnStartCallback);

            transport.authorizePromise.then(() => {
                expect(transport.socket.onmessage).not.toBeNull();
                const base64Payload =
                    'MAAAAAAAAAAAAApfaGVhcnRiZWF0AGEAAABbeyJSZWZlcmVuY2VJZCI6Il9oZWFydGJlYXQiLCJIZWFydGJlYXRzIjpbeyJPcmlnaW5hdGluZ1JlZmVyZW5jZUlkIjoiNyIsIlJlYXNvbiI6Ik5vTmV3RGF0YSJ9XX1d';
                const payload = Uint8Array.from(atob(base64Payload), (c) =>
                    c.charCodeAt(0),
                );

                transport.socket.onmessage({ data: payload.buffer });
                expect(spyOnReceivedCallback).toBeCalledTimes(1);
                expect(spyOnReceivedCallback).toBeCalledWith([
                    {
                        Data: [
                            {
                                Heartbeats: [
                                    {
                                        OriginatingReferenceId: '7',
                                        Reason: 'NoNewData',
                                    },
                                ],
                                ReferenceId: '_heartbeat',
                            },
                        ],
                        DataFormat: 0,
                        ReferenceId: '_heartbeat',
                        ReservedField: 0,
                    },
                ]);
                done();
            });
        });
    });

    describe('connection states', () => {
        let transport;
        let stateChangedSpy;
        let spyOnStartCallback;
        let unauthorizedCallbackStub;

        function givenTransport(options) {
            spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            restTransportMock.put.mockImplementation(() =>
                Promise.resolve({ data: [] }),
            );

            transport = new WebSocketTransport(BASE_URL, restTransportMock);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);
            stateChangedSpy = jest.fn().mockName('stateChanged');
            transport.setStateChangedCallback(stateChangedSpy);
            
            unauthorizedCallbackStub = jest.fn().mockImplementation(() => transport.updateQuery(AUTH_TOKEN, CONTEXT_ID, true));
            transport.setUnauthorizedCallback(unauthorizedCallbackStub);
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
                transport.socket.onclose({ code: 1002 });

                expect(stateChangedSpy.mock.calls[2]).toEqual([
                    constants.CONNECTION_STATE_RECONNECTING,
                ]);

                tick(2000);

                expect(
                    transport.authorizePromise === initialPromise,
                ).toBeFalsy();

                done();
            });
        });
    });
});
