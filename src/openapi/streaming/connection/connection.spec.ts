import Connection from './connection';
import * as transportTypes from './transportTypes';
import 'fast-text-encoding';

describe('openapi Streaming connection', () => {
    const baseUrl = 'test-url';
    const token = 'token';
    const contextId = '00000000';
    let mockWithUrlConfig: jest.Mock;
    let mockHubConnection: Record<string, jest.Mock>;
    let connection: Connection;

    beforeEach(() => {
        mockWithUrlConfig = jest.fn();

        mockHubConnection = {
            start: jest.fn(),
            stream: jest.fn(),
            invoke: jest.fn(),
            onclose: jest.fn(),
            onreconnecting: jest.fn(),
            onreconnected: jest.fn(),
        };

        class MockConnectionBuilder {
            withUrl(...args: unknown[]) {
                mockWithUrlConfig(...args);
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

        // @ts-ignore
        global.signalrCore = {
            HubConnectionBuilder: MockConnectionBuilder,
            JsonHubProtocol: () => {},
            HttpTransportType: {
                WebSockets: 1,
                LongPolling: 4,
            },
        };

        connection = new Connection(
            {
                transport: [
                    transportTypes.SIGNALR_CORE_WEBSOCKETS,
                    transportTypes.SIGNALR_CORE_LONG_POLLING,
                ],
            },
            baseUrl,
        );
        connection.updateQuery(token, contextId, Date.now());
    });

    describe('transport fallback', () => {
        it('should fallback to signalr longpolling if websocket fails', (done) => {
            mockHubConnection.start.mockImplementation(() => Promise.reject());

            connection.start(() => {});
            expect(mockWithUrlConfig).toHaveBeenCalledWith(
                `${baseUrl}/streaming?contextId=${contextId}`,
                expect.objectContaining({
                    skipNegotiation: true,
                    // @ts-ignore
                    transport: global.signalrCore.HttpTransportType.WebSockets,
                }),
            );

            // wait for promise flush
            setTimeout(() => {
                expect(mockWithUrlConfig).toHaveBeenNthCalledWith(
                    2,
                    `${baseUrl}/streaming?contextId=${contextId}`,
                    expect.objectContaining({
                        skipNegotiation: false,
                        transport:
                            // @ts-ignore
                            global.signalrCore.HttpTransportType.LongPolling,
                    }),
                );

                done();
            });
        });
    });
});
