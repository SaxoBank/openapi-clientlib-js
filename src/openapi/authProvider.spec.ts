import { setTimeout, tick, installClock, uninstallClock } from '../test/utils';
import mockFetch from '../test/mocks/fetch';
import AuthProvider from './authProvider';

describe('openapi AuthProvider', () => {
    let authProvider: AuthProvider;
    let fetch: ReturnType<typeof mockFetch>;

    beforeEach(() => {
        installClock();
        fetch = mockFetch();
    });
    afterEach(function () {
        uninstallClock();
        if (authProvider) {
            authProvider.dispose();
            // @ts-ignore
            authProvider = null;
        }
    });

    function relativeDate(relativeTime: number) {
        return new Date().getTime() + relativeTime * 1000;
    }

    it('throws an exception if created without options', () => {
        expect(() => {
            // @ts-expect-error testing invalid input
            new AuthProvider();
        }).toThrow();
        expect(() => {
            new AuthProvider({});
        }).toThrow();
    });

    describe('auth store', () => {
        it('gets and sets', () => {
            const options = {
                token: 'Bearer TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'refresh',
            };

            authProvider = new AuthProvider(options);

            expect(authProvider.getToken()).toEqual(options.token);
            expect(authProvider.getExpiry()).toEqual(options.expiry);

            const newAuth = { token: 'Bearer TOK2', expiry: relativeDate(60) };
            authProvider.set(newAuth.token, newAuth.expiry);
            expect(authProvider.getToken()).toEqual(newAuth.token);
            expect(authProvider.getExpiry()).toEqual(newAuth.expiry);
        });

        it('gets and sets adding Bearer', () => {
            const options = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'refresh',
            };

            authProvider = new AuthProvider(options);

            expect(authProvider.getToken()).toEqual('Bearer ' + options.token);
            expect(authProvider.getExpiry()).toEqual(options.expiry);

            const newAuth = { token: 'TOK2', expiry: relativeDate(60) };
            authProvider.set(newAuth.token, newAuth.expiry);
            expect(authProvider.getToken()).toEqual('Bearer ' + newAuth.token);
            expect(authProvider.getExpiry()).toEqual(newAuth.expiry);
        });
    });

    describe('auth events', function () {
        it('fires an event when about to refresh', function () {
            const options = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            authProvider.on(authProvider.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            tick(60000);

            authProvider.off(authProvider.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            expect(tokenRefreshSpy).toBeCalledTimes(1);

            authProvider.set('TOK3', relativeDate(0));
            expect(tokenRefreshSpy).toBeCalledTimes(1);
        });

        it('fires an event when receiving a new token', function (done) {
            const options = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(options);

            const tokenReceivedSpy = jest
                .fn()
                .mockName('tokenReceived listener');
            const tokenRefreshFailSpy = jest
                .fn()
                .mockName('tokenRefreshFail listener');
            authProvider.on(
                authProvider.EVENT_TOKEN_REFRESH_FAILED,
                tokenRefreshFailSpy,
            );
            authProvider.on(
                authProvider.EVENT_TOKEN_RECEIVED,
                tokenReceivedSpy,
            );
            tick(60000);

            fetch.resolve(200, { token: 'TOK3', expiry: 60 });
            setTimeout(function () {
                authProvider.off(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.off(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );
                expect(tokenReceivedSpy).toBeCalledTimes(1);

                authProvider.set('TOK4', relativeDate(0));
                fetch.resolve(200, { token: 'TOK5', expiry: 60 });
                setTimeout(function () {
                    expect(tokenReceivedSpy).toBeCalledTimes(1);
                    expect(tokenRefreshFailSpy).not.toBeCalled();
                    done();
                });
            });
        });

        describe('when token refreshing fails', function () {
            it('fires an event if unauthorized - 401', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );

                tick(60000);
                fetch.resolve(401, { error: 'not authorised' });
                setTimeout(function () {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                    done();
                });
            });

            it('fires an event if unauthorized - 403', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );

                tick(60000);
                fetch.resolve(403, { error: 'not authorised' });
                setTimeout(function () {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                    done();
                });
            });

            it('fires an event if unauthorized - 407', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );

                tick(60000);
                fetch.resolve(407, { error: 'not authorised' });
                setTimeout(function () {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                    done();
                });
            });

            it('fires an event if forbidden', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );
                tick(60000);
                fetch.resolve(403, { error: 'forbidden' });
                setTimeout(function () {
                    authProvider.off(
                        authProvider.EVENT_TOKEN_REFRESH_FAILED,
                        tokenRefreshFailSpy,
                    );
                    authProvider.off(
                        authProvider.EVENT_TOKEN_RECEIVED,
                        tokenReceivedSpy,
                    );
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                    done();
                });
            });

            it('fires an event after retrying', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                    maxRetryCount: 1,
                    retryDelayMs: 1000,
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );
                tick(60000);
                expect(fetch).toHaveBeenCalledTimes(1);
                fetch.reject(new Error('Network error'));
                setTimeout(function () {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    tick(1000);
                    expect(fetch).toHaveBeenCalledTimes(2);
                    fetch.reject(new Error('Network error'));
                    setTimeout(function () {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(
                            1,
                        );
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(0);
                        done();
                    });
                });
            });

            it('retries and recovers after a fail', function (done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                    maxRetryCount: 1,
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest
                    .fn()
                    .mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest
                    .fn()
                    .mockName('tokenReceived listener');
                authProvider.on(
                    authProvider.EVENT_TOKEN_REFRESH_FAILED,
                    tokenRefreshFailSpy,
                );
                authProvider.on(
                    authProvider.EVENT_TOKEN_RECEIVED,
                    tokenReceivedSpy,
                );
                tick(60000);
                fetch.reject(new Error('Network error'));
                setTimeout(function () {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    tick(1000);
                    fetch.resolve(200, { token: 'TOK5', expiry: 60 });
                    setTimeout(function () {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(
                            0,
                        );
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(1);
                        done();
                    });
                });
            });
        });
    });

    describe('refreshing', () => {
        it('allows no arguments and defaults to expired', function () {
            const options = { tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(options);

            expect(authProvider.getExpiry()).toEqual(relativeDate(0));
            expect(authProvider.getToken()).toEqual(null);
            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual([
                'http://refresh',
                expect.objectContaining({ method: 'POST' }),
            ]);
        });

        it('refreshes immediately if the token is out of date', (done) => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(-1),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(authProvider.getToken()).toEqual(
                'Bearer ' + initialOptions.token,
            );
            expect(authProvider.getExpiry()).toEqual(initialOptions.expiry);

            expect(fetch.mock.calls[0][0]).toEqual('http://refresh');
            expect(fetch.mock.calls[0][1]?.method).toEqual('POST');

            fetch.resolve(200, { token: 'TOK2', expiry: 60 });
            setTimeout(function () {
                expect(authProvider.getToken()).toEqual('Bearer TOK2');
                done();
            });
        });

        it('includes the headers passed in as options', () => {
            const headersOption = { foo: 'bar' };
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };

            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(-1),
                tokenRefreshUrl: 'http://refresh',
                tokenRefreshHeaders: headersOption,
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0][1]?.headers).toMatchObject(
                expectedHeaders,
            );
        });

        it('includes the headers passed in as options and does not override content-type', () => {
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };
            const headersOption = expectedHeaders;

            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(-1),
                tokenRefreshUrl: 'http://refresh',
                tokenRefreshHeaders: headersOption,
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0][1]?.headers).toMatchObject(
                expectedHeaders,
            );
        });

        it('refreshes when the token becomes out of date', (done) => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(10),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);
            expect(fetch).not.toBeCalled();

            tick(10000);

            expect(fetch).toBeCalledTimes(1);
            expect(authProvider.getToken()).toEqual(
                'Bearer ' + initialOptions.token,
            );
            expect(authProvider.getExpiry()).toEqual(initialOptions.expiry);

            fetch.resolve(200, { token: 'TOK2', expiry: 60 });
            setTimeout(function () {
                expect(authProvider.getToken()).toEqual('Bearer TOK2');

                tick(60000);

                expect(fetch).toBeCalledTimes(2);
                expect(authProvider.getToken()).toEqual('Bearer TOK2');

                fetch.resolve(200, { token: 'TOK3', expiry: 60 });
                setTimeout(function () {
                    expect(authProvider.getToken()).toEqual('Bearer TOK3');
                    done();
                });
            });
        });

        it('retries if the auth refresh fails', (done) => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(10),
                tokenRefreshUrl: 'http://refresh',
                retryDelayMs: 599,
                maxRetryCount: 1,
            };
            authProvider = new AuthProvider(initialOptions);

            tick(10000);

            expect(fetch).toBeCalledTimes(1);
            fetch.resolve(400);

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);

                tick(599);
                setTimeout(() => {
                    expect(fetch).toBeCalledTimes(2);
                    fetch.resolve(400);

                    tick(10000);
                    setTimeout(() => {
                        expect(fetch).toBeCalledTimes(2); // stops retrying because maxRetry is 1
                        done();
                    });
                });
            });
        });

        it("when refresh token is called it doesn't still refresh the token when it becomes expired before the call returns", () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(10),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);
            expect(fetch).not.toBeCalled();

            tick(9999);
            expect(fetch).not.toBeCalled();
            authProvider.refreshOpenApiToken();
            expect(fetch).toBeCalledTimes(1);
            tick(100000);
            expect(fetch).toBeCalledTimes(1);
        });

        it('refreshes the token when a transport call returns a 401 - no expiry time', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            authProvider.tokenRejected();
            expect(fetch).toBeCalledTimes(1);
        });

        it('does not refresh the token when a transport call returns a 401 because it is already fetching or under time', (done) => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            tick(60000);
            expect(fetch).toBeCalledTimes(1);

            // ignored because fetch is in progress
            authProvider.tokenRejected();
            expect(fetch).toBeCalledTimes(1);
            fetch.resolve(200, { token: 'TOK2', expiry: 60 });
            setTimeout(() => {
                // ignored because lt 10,000 ms has passed since new token
                authProvider.tokenRejected();
                expect(fetch).toBeCalledTimes(1);
                tick(10001);
                authProvider.tokenRejected();
                expect(fetch).toBeCalledTimes(2);
                done();
            });
        });

        it('refreshes the token when a transport call returns a 401 - with expiry time', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            authProvider.tokenRejected(relativeDate(60));
            expect(fetch).toBeCalledTimes(1);
        });

        it('doesnt refresh the token when a transport call returns a 401 - with expiry time when new token exists', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            authProvider.tokenRejected(relativeDate(-60));
            expect(fetch).toBeCalledTimes(0);
        });

        it('does not refresh the token when a transport call returns a 401 with expiry time because it is already fetching or under time', (done) => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            tick(600000);
            expect(fetch).toBeCalledTimes(1);

            // ignored because fetch is in progress
            authProvider.tokenRejected(relativeDate(60));
            expect(fetch).toBeCalledTimes(1);
            fetch.resolve(200, { token: 'TOK2', expiry: 60 });
            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                authProvider.tokenRejected(relativeDate(60));
                expect(fetch).toBeCalledTimes(2);
                done();
            });
        });

        it('does not refresh the token when already fetching and refreshOpenApiToken is called', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            tick(600000);
            expect(fetch).toBeCalledTimes(1);

            // ignored because fetch is in progress
            authProvider.refreshOpenApiToken();
            expect(fetch).toBeCalledTimes(1);
        });

        it('does a refresh if the timer should have fired but didnt (dropping timeouts while sleeping) - tokenRejected', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(10),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            // @ts-expect-error - don't care that timer id may be null
            clearTimeout(authProvider.tokenRefreshTimer);
            tick(15000);

            authProvider.tokenRejected(relativeDate(-5));

            expect(fetch).toBeCalledTimes(1);
        });

        it('does a refresh if the timer should have fired but didnt (dropping timeouts while sleeping) - refreshOpenApiToken', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(10),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            // @ts-expect-error - don't care that timer id may be null
            clearTimeout(authProvider.tokenRefreshTimer);
            tick(15000);

            authProvider.refreshOpenApiToken();

            expect(fetch).toBeCalledTimes(1);
        });

        it('does nothing if the token is in date', () => {
            const initialOptions = {
                token: 'TOKEN',
                expiry: relativeDate(60),
                tokenRefreshUrl: 'http://refresh',
            };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
        });
    });
});
