import { installClock, uninstallClock } from '../../../../test/utils';
import '../../../../test/mocks/math-random';
import log from '../../../../log';
import SignalRTransport from './signalr-transport';
import * as constants from './../constants';

const CONTEXT_ID = '0000000000';
const AUTH_TOKEN = 'TOKEN';
const BASE_URL = 'testUrl';

describe('openapi SignalR Transport', () => {

    let stateChangedCallback;
    let connectionSlowCallback;
    let errorCallback;
    let startCallback;
    let receivedCallback;
    let mockConnection;

    beforeEach(() => {

        mockConnection = {
            'stateChanged': jest.fn(),
            'start': jest.fn(),
            'received': jest.fn(),
            'error': jest.fn(),
            'connectionSlow': jest.fn(),
            'stop': jest.fn(),
        };
        mockConnection.stateChanged.mockImplementation((callback) => {
            stateChangedCallback = callback;
        });
        mockConnection.start.mockImplementation((options, callback) => {
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

        installClock();
    });
    afterEach(() => uninstallClock());

    describe('start', () => {
        it('should call start and connection methods upon transport start invocation', () => {
            const spyOnStartCallback = jest.fn().mockName('spyStartCallback');
            const options = {};
            const transport = new SignalRTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options, spyOnStartCallback);

            startCallback();

            expect(spyOnStartCallback.mock.calls.length).toEqual(1);
            expect(global.$.connection.mock.calls.length).toEqual(1);
            expect(global.$.connection.mock.calls[0]).toEqual(['testUrl/streaming/connection']);
            expect(transport.connection.qs).toEqual(`authorization=${AUTH_TOKEN}&context=${CONTEXT_ID}`);
        });
    });

    describe('updateQuery', () => {
        it('should update connection qs with new authorization token and context id', () => {
            const transport = new SignalRTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            expect(transport.connection.qs).toEqual(`authorization=${AUTH_TOKEN}&context=${CONTEXT_ID}`);
        });
    });

    describe('received', () => {
        it('should call received callback upon signalr received being called', () => {
            const spyOnReceivedCallback = jest.fn().mockName('spyReceivedCallback');

            const transport = new SignalRTransport(BASE_URL);
            transport.setReceivedCallback(spyOnReceivedCallback);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start();

            receivedCallback({ data: {}, referenceId: '123' });

            expect(spyOnReceivedCallback.mock.calls.length).toEqual(1);
        });
    });

    describe('connection states', () => {
        let transport;
        let stateChangedSpy;

        function givenTransport(options) {
            transport = new SignalRTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start(options);
            stateChangedSpy = jest.fn().mockName('stateChanged');
            transport.setStateChangedCallback(stateChangedSpy);
            return transport;
        }

        it('should call stateChanged callback with connecting state when internal signalR state changed to connecting (0)', () => {
            givenTransport();
            stateChangedCallback({ newState: 0 /* connecting */ });
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([constants.CONNECTION_STATE_CONNECTING]);
        });

        it('should call stateChanged callback with connected state when internal signalR state changed to connected (1)', () => {
            givenTransport();
            stateChangedCallback({ newState: 1 /* connected */ });
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([constants.CONNECTION_STATE_CONNECTED]);
        });

        it('should call stateChanged callback with disconnected state when internal signalR state changed to disconnected (4)', () => {
            givenTransport();
            stateChangedCallback({ newState: 1 /* connected */ });
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([constants.CONNECTION_STATE_CONNECTED]);
        });

        it('should call stateChanged callback with reconnecting state when internal signalR state changed to reconnecting (2)', () => {
            givenTransport();
            stateChangedCallback({ newState: 1 /* connected */ });
            expect(stateChangedSpy.mock.calls.length).toEqual(1);
            expect(stateChangedSpy.mock.calls[0]).toEqual([constants.CONNECTION_STATE_CONNECTED]);
        });
    });

    describe('signal-r events', () => {
        let transport;

        beforeEach(() => {
            transport = new SignalRTransport(BASE_URL);
            transport.updateQuery(AUTH_TOKEN, CONTEXT_ID);
            transport.start();
        });

        it('handles connection slow events', () => {
            const connectionSlowSpy = jest.fn().mockName('spyOnConnectionSlow');
            transport.setConnectionSlowCallback(connectionSlowSpy);
            connectionSlowCallback();
            expect(connectionSlowSpy.mock.calls.length).toEqual(1);
        });
        it('handles connection error events', () => {
            jest.spyOn(log, 'error');
            errorCallback('error details');
            expect(log.error.mock.calls.length).toEqual(1);
        });
        it('handles signal-r log calls', () => {
            jest.spyOn(log, 'debug');
            mockConnection.log('my message');
            expect(log.debug.mock.calls.length).toEqual(1);
        });
    });
});
