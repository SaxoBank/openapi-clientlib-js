import { setTimeout, tick, installClock, uninstallClock } from '../test/utils';
import mockFetch from '../test/mocks/fetch';
import AuthProvider from './authProvider';

describe('openapi AuthProvider', () => {

    const noop = () => {};
    let authProvider;
    let fetch;

    beforeEach(() => {
        installClock();
        fetch = mockFetch();
    });
    afterEach(function() {
        uninstallClock();
        if (authProvider) {
            authProvider.dispose();
            authProvider = null;
        }
    });

    function relativeDate(relativeTime) {
        return new Date().getTime() + (relativeTime * 1000);
    }

    it('throws an exception if created without options', () => {
        expect(() => {
            new AuthProvider();
        }).toThrow();
        expect(() => {
            new AuthProvider({});
        }).toThrow();
    });

    describe('auth store', () => {

        it('gets and sets', () => {
            const options = { token: 'Bearer TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'refresh' };

            authProvider = new AuthProvider(options);

            expect(authProvider.getToken()).toEqual(options.token);
            expect(authProvider.getExpiry()).toEqual(options.expiry);

            const newAuth = { token: 'Bearer TOK2', expiry: relativeDate(60) };
            authProvider.set(newAuth.token, newAuth.expiry);
            expect(authProvider.getToken()).toEqual(newAuth.token);
            expect(authProvider.getExpiry()).toEqual(newAuth.expiry);
        });

        it('gets and sets adding Bearer', () => {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'refresh' };

            authProvider = new AuthProvider(options);

            expect(authProvider.getToken()).toEqual('Bearer ' + options.token);
            expect(authProvider.getExpiry()).toEqual(options.expiry);
            expect(authProvider.isAuthorised).toEqual(true);

            const newAuth = { token: 'TOK2', expiry: relativeDate(60) };
            authProvider.set(newAuth.token, newAuth.expiry);
            expect(authProvider.getToken()).toEqual('Bearer ' + newAuth.token);
            expect(authProvider.getExpiry()).toEqual(newAuth.expiry);
        });
    });

    describe('auth events', function() {
        it('fires an event when about to refresh', function() {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            authProvider.on(authProvider.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            authProvider.set('TOK2', relativeDate(0));
            authProvider.off(authProvider.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            expect(tokenRefreshSpy).toBeCalledTimes(1);

            authProvider.set('TOK3', relativeDate(0));
            expect(tokenRefreshSpy).toBeCalledTimes(1);
        });
        it('fires an event when receiving a new token', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(options);

            const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
            const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
            authProvider.on(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
            authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
            authProvider.set('TOK2', relativeDate(0));
            fetch.resolve('200', { token: 'TOK3', expiry: 60 });
            setTimeout(function() {
                authProvider.off(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                authProvider.off(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                expect(tokenReceivedSpy).toBeCalledTimes(1);

                authProvider.set('TOK4', relativeDate(0));
                fetch.resolve('200', { token: 'TOK5', expiry: 60 });
                setTimeout(function() {
                    expect(tokenReceivedSpy).toBeCalledTimes(1);
                    expect(tokenRefreshFailSpy).not.toBeCalled();
                    done();
                });
            });
        });
        describe('when token refreshing fails', function() {
            it('fires an event if unauthorized', function(done) {
                const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                authProvider.on(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);

                authProvider.set('TOK2', relativeDate(0));
                fetch.resolve(401, { error: 'not authorised' });
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);

                    authProvider.set('TOK4', relativeDate(0));
                    fetch.resolve(403, { error: 'not authorised' });
                    setTimeout(function() {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(2);
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(0);
                        done();
                    });
                });
            });
            it('fires an event if forbidden', function(done) {
                const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                authProvider.on(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                authProvider.set('TOK2', relativeDate(0));
                fetch.resolve(403, { error: 'forbidden' });
                setTimeout(function() {
                    authProvider.off(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                    authProvider.off(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);

                    authProvider.set('TOK4', relativeDate(0));
                    fetch.resolve(403, { error: 'forbidden' });
                    setTimeout(function() {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(0);
                        done();
                    });
                });
            });
            it('fires an event after retrying', function(done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                    maxRetryCount: 1,
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                authProvider.on(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                authProvider.set('TOK2', relativeDate(0));
                fetch.reject(new Error('Network error'));
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    authProvider.set('TOK4', relativeDate(0));
                    fetch.reject(new Error('Network error'));
                    setTimeout(function() {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(0);
                        done();
                    });
                });
            });
            it('retries and recovers after a fail', function(done) {
                const options = {
                    token: 'TOKEN',
                    expiry: relativeDate(60),
                    tokenRefreshUrl: 'http://refresh',
                    maxRetryCount: 1,
                };
                authProvider = new AuthProvider(options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                authProvider.on(authProvider.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                authProvider.on(authProvider.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                authProvider.set('TOK2', relativeDate(0));
                fetch.reject(new Error('Network error'));
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    authProvider.set('TOK4', relativeDate(0));
                    fetch.resolve(200, { token: 'TOK5', expiry: 60 });
                    setTimeout(function() {
                        expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                        expect(tokenReceivedSpy.mock.calls.length).toEqual(1);
                        done();
                    });
                });
            });
        });
    });

    describe('refreshing', () => {
        it('allows no arguments and defaults to expired', function() {
            const options = { tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(options);

            expect(authProvider.getExpiry()).toEqual(relativeDate(0));
            expect(authProvider.getToken()).toEqual(null);
            expect(authProvider.isAuthorised).toEqual(false);
            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(['http://refresh', expect.objectContaining({ method: 'POST' })]);
        });

        it('refreshes immediately if the token is out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            expect(authProvider.isAuthorised).toEqual(false);
            expect(fetch).toBeCalledTimes(1);
            expect(authProvider.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(authProvider.getExpiry()).toEqual(initialOptions.expiry);

            expect(fetch.mock.calls[0][0]).toEqual('http://refresh');
            expect(fetch.mock.calls[0][1].method).toEqual('POST');

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            setTimeout(function() {
                expect(authProvider.getToken()).toEqual('Bearer TOK2');
                expect(authProvider.isAuthorised).toEqual(true);
                done();
            });
        });

        it('includes the headers passed in as options', () => {
            const headersOption = { foo: 'bar' };
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };

            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh', tokenRefreshHeaders: headersOption };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(expect.anything(), expect.objectContaining({ headers: expectedHeaders }));
        });

        it('includes the headers passed in as options and does not override content-type', () => {
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };
            const headersOption = expectedHeaders;

            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh', tokenRefreshHeaders: headersOption };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(expect.anything(), expect.objectContaining({ headers: expectedHeaders }));
        });

        it('refreshes when the token becomes out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);
            expect(fetch).not.toBeCalled();

            tick(10000);

            expect(authProvider.isAuthorised).toEqual(true);
            expect(fetch).toBeCalledTimes(1);
            expect(authProvider.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(authProvider.getExpiry()).toEqual(initialOptions.expiry);

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            setTimeout(function() {
                expect(authProvider.getToken()).toEqual('Bearer TOK2');

                tick(60000);

                expect(authProvider.isAuthorised).toEqual(true);
                expect(fetch).toBeCalledTimes(2);
                expect(authProvider.getToken()).toEqual('Bearer TOK2');

                fetch.resolve('200', { token: 'TOK3', expiry: 60 });
                setTimeout(function() {
                    expect(authProvider.isAuthorised).toEqual(true);
                    expect(authProvider.getToken()).toEqual('Bearer TOK3');
                    done();
                });
            });
        });

        it('retries if the auth refresh fails', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh', retryDelayMs: 599, maxRetryCount: 1 };
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

        it('when refresh token is called it doesn\'t still refresh the token when it becomes expired before the call returns', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);
            expect(fetch).not.toBeCalled();

            tick(9999);
            expect(fetch).not.toBeCalled();
            authProvider.refreshOpenApiToken();
            expect(fetch).toBeCalledTimes(1);
            tick(100000);
            expect(fetch).toBeCalledTimes(1);
        });

        it('refreshes the token when a transport call returns a 401', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            authProvider.tokenRejected();
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(401);

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                done();
            });
        });

        it('does nothing when a transport call returns a 401 and it is already refreshing', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            tick(9999);
            expect(fetch).not.toBeCalled();
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            tick(10000); // will trigger a refresh

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                fetch.resolve(401); // shouldn't trigger a refresh

                setTimeout(() => {
                    expect(fetch).toBeCalledTimes(1);
                    done();
                });
            });
        });

        it('does a refresh if the timer should have fired but didnt (dropping timeouts while sleeping)', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            clearTimeout(authProvider.tokenRefreshTimer);
            tick(15000);
            expect(fetch.mock.calls.length).toEqual(0);
            authProvider.get('service_group', 'url').catch(noop);
            expect(fetch.mock.calls.length).toEqual(1);

            fetch.resolve(401); // should notice the timer hasnt fired like it should

            setTimeout(() => {
                expect(fetch.mock.calls.length).toEqual(2);
                done();
            });
        });

        it('does nothing when a transport call returns a 401 and it is refresh retrying', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            authProvider.get('service_group', 'url').catch(noop);
            const getResolve = fetch.resolve;
            fetch.mockClear();

            tick(10000);
            expect(fetch).toBeCalledTimes(1);
            // reject the refresh request so it will retry
            fetch.reject();

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                // should be waiting to retry again

                getResolve(401);
                expect(fetch).toBeCalledTimes(1);

                setTimeout(() => {
                    expect(fetch).toBeCalledTimes(1);

                    tick(1000);

                    setTimeout(() => {
                        expect(fetch).toBeCalledTimes(2);
                        done();
                    });
                });
            });
        });

        it('refreshes the token once when multiple transport calls return a 401', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
            authProvider.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(401);

            expect(fetch).not.toBeCalled();
            authProvider.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(401);

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                done();
            });
        });

        it('does nothing if the token is in date', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            authProvider = new AuthProvider(initialOptions);

            expect(fetch).not.toBeCalled();
        });
    });
});
