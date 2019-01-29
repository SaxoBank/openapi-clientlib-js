import { setTimeout, tick, waterfallTimeout, installClock, uninstallClock } from '../../test/utils';
import mockFetch from '../../test/mocks/fetch';
import TransportAuth from './auth';

describe('openapi TransportAuth', () => {

    const noop = () => {};
    let transportAuth;
    let fetch;

    beforeEach(() => {
        installClock();
        fetch = mockFetch();
    });
    afterEach(function() {
        uninstallClock();
        if (transportAuth) {
            transportAuth.dispose();
            transportAuth = null;
        }
    });

    function relativeDate(relativeTime) {
        return new Date().getTime() + (relativeTime * 1000);
    }

    it('throws an exception if created without a token refresh url', () => {
        expect(() => {
            new TransportAuth();
        }).toThrow();
        expect(() => {
            new TransportAuth({});
        }).toThrow();
    });

    describe('auth store', () => {

        it('gets and sets', () => {
            const options = { token: 'Bearer TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'refresh' };

            transportAuth = new TransportAuth('localhost/openapi', options);

            expect(transportAuth.auth.getToken()).toEqual(options.token);
            expect(transportAuth.auth.getExpiry()).toEqual(options.expiry);
            expect(transportAuth.isAuthorised).toEqual(true);

            const newAuth = { token: 'Bearer TOK2', expiry: relativeDate(60) };
            transportAuth.auth.set(newAuth.token, newAuth.expiry);
            expect(transportAuth.auth.getToken()).toEqual(newAuth.token);
            expect(transportAuth.auth.getExpiry()).toEqual(newAuth.expiry);
        });

        it('gets and sets adding Bearer', () => {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'refresh' };

            transportAuth = new TransportAuth('localhost/openapi', options);

            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + options.token);
            expect(transportAuth.auth.getExpiry()).toEqual(options.expiry);
            expect(transportAuth.isAuthorised).toEqual(true);

            const newAuth = { token: 'TOK2', expiry: relativeDate(60) };
            transportAuth.auth.set(newAuth.token, newAuth.expiry);
            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + newAuth.token);
            expect(transportAuth.auth.getExpiry()).toEqual(newAuth.expiry);
        });
    });

    describe('auth events', function() {
        it('fires an event when about to refresh', function() {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            transportAuth.auth.set('TOK2', relativeDate(0));
            transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            expect(tokenRefreshSpy).toBeCalledTimes(1);

            transportAuth.auth.set('TOK3', relativeDate(0));
            expect(tokenRefreshSpy).toBeCalledTimes(1);
        });
        it('fires an event when receiving a new token', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
            const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
            transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
            transportAuth.auth.set('TOK2', relativeDate(0));
            fetch.resolve('200', { token: 'TOK3', expiry: 60 });
            setTimeout(function() {
                transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.off(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                expect(tokenReceivedSpy).toBeCalledTimes(1);

                transportAuth.auth.set('TOK4', relativeDate(0));
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
                transportAuth = new TransportAuth('localhost/openapi', options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);

                transportAuth.auth.set('TOK2', relativeDate(0));
                fetch.resolve(401, { error: 'not authorised' });
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);

                    transportAuth.auth.set('TOK4', relativeDate(0));
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
                transportAuth = new TransportAuth('localhost/openapi', options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                transportAuth.auth.set('TOK2', relativeDate(0));
                fetch.resolve(403, { error: 'forbidden' });
                setTimeout(function() {
                    transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                    transportAuth.off(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(1);

                    transportAuth.auth.set('TOK4', relativeDate(0));
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
                transportAuth = new TransportAuth('localhost/openapi', options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                transportAuth.auth.set('TOK2', relativeDate(0));
                fetch.reject(new Error('Network error'));
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    transportAuth.auth.set('TOK4', relativeDate(0));
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
                transportAuth = new TransportAuth('localhost/openapi', options);

                const tokenRefreshFailSpy = jest.fn().mockName('tokenRefreshFail listener');
                const tokenReceivedSpy = jest.fn().mockName('tokenReceived listener');
                transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                transportAuth.auth.set('TOK2', relativeDate(0));
                fetch.reject(new Error('Network error'));
                setTimeout(function() {
                    expect(tokenRefreshFailSpy.mock.calls.length).toEqual(0);
                    transportAuth.auth.set('TOK4', relativeDate(0));
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
            transportAuth = new TransportAuth('localhost/openapi', options);

            expect(transportAuth.auth.getExpiry()).toEqual(relativeDate(0));
            expect(transportAuth.auth.getToken()).toEqual(null);
            expect(transportAuth.isAuthorised).toEqual(false);
            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(['http://refresh', expect.objectContaining({ method: 'POST' })]);
        });

        it('refreshes immediately if the token is out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(transportAuth.isAuthorised).toEqual(false);
            expect(fetch).toBeCalledTimes(1);
            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(transportAuth.auth.getExpiry()).toEqual(initialOptions.expiry);

            expect(fetch.mock.calls[0][0]).toEqual('http://refresh');
            expect(fetch.mock.calls[0][1].method).toEqual('POST');

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            setTimeout(function() {
                expect(transportAuth.auth.getToken()).toEqual('Bearer TOK2');
                expect(transportAuth.isAuthorised).toEqual(true);
                done();
            });
        });

        it('includes the headers passed in as options', () => {
            const headersOption = { foo: 'bar' };
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };

            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh', tokenRefreshHeaders: headersOption };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(expect.anything(), expect.objectContaining({ headers: expectedHeaders }));
        });

        it('includes the headers passed in as options and does not override content-type', () => {
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };
            const headersOption = expectedHeaders;

            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh', tokenRefreshHeaders: headersOption };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual(expect.anything(), expect.objectContaining({ headers: expectedHeaders }));
        });

        it('refreshes when the token becomes out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);
            expect(fetch).not.toBeCalled();

            tick(10000);

            expect(transportAuth.isAuthorised).toEqual(true);
            expect(fetch).toBeCalledTimes(1);
            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(transportAuth.auth.getExpiry()).toEqual(initialOptions.expiry);

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            setTimeout(function() {
                expect(transportAuth.auth.getToken()).toEqual('Bearer TOK2');

                tick(60000);

                expect(transportAuth.isAuthorised).toEqual(true);
                expect(fetch).toBeCalledTimes(2);
                expect(transportAuth.auth.getToken()).toEqual('Bearer TOK2');

                fetch.resolve('200', { token: 'TOK3', expiry: 60 });
                setTimeout(function() {
                    expect(transportAuth.isAuthorised).toEqual(true);
                    expect(transportAuth.auth.getToken()).toEqual('Bearer TOK3');
                    done();
                });
            });
        });

        it('retries if the auth refresh fails', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh', retryDelayMs: 599, maxRetryCount: 1 };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

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
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);
            expect(fetch).not.toBeCalled();

            tick(9999);
            expect(fetch).not.toBeCalled();
            transportAuth.refreshOpenApiToken();
            expect(fetch).toBeCalledTimes(1);
            tick(100000);
            expect(fetch).toBeCalledTimes(1);
        });

        it('refreshes the token when a transport call returns a 401', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(401);

            setTimeout(() => {
                expect(fetch).toBeCalledTimes(1);
                done();
            });
        });

        it('does nothing when a transport call fails with a different error code', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(402);

            setTimeout(() => {
                expect(fetch).not.toBeCalled();
                done();
            });
        });

        it('does nothing when a transport call returns a 401 and it is already refreshing', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            tick(9999);
            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url');
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
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            clearTimeout(transportAuth.tokenRefreshTimer);
            tick(15000);
            expect(fetch.mock.calls.length).toEqual(0);
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch.mock.calls.length).toEqual(1);

            fetch.resolve(401); // should notice the timer hasnt fired like it should

            setTimeout(() => {
                expect(fetch.mock.calls.length).toEqual(2);
                done();
            });
        });

        it('does nothing when a transport call returns a 401 and it is refresh retrying', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.get('service_group', 'url').catch(noop);
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
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(401);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url').catch(noop);
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
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
        });
    });

    describe('auth transport', function() {
        it('adds on a auth header when methods are called', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url');
            expect(fetch).toBeCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } }));
            fetch.mockClear();

            transportAuth.get('service_group', 'url', {}, {});
            expect(fetch).toBeCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } }));
        });

        it('supports all the http verbs', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.get('service_group', 'url');
            transportAuth.put('service_group', 'url');
            transportAuth.post('service_group', 'url');
            transportAuth.patch('service_group', 'url');
            transportAuth.delete('service_group', 'url');
            expect(fetch).toBeCalledTimes(5);
            expect(fetch.mock.calls[0]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
            expect(fetch.mock.calls[1]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
            expect(fetch.mock.calls[2]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
            expect(fetch.mock.calls[3]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
            expect(fetch.mock.calls[4]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
        });

        it('overrides an auth header if one exists', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url', {}, { headers: { Authorization: 'MYTOKEN' } });
            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual([expect.anything(), expect.objectContaining({ headers: { Authorization: 'Bearer TOKEN', 'X-Request-Id': expect.any(Number) } })]);
        });

        it('counts transport authorization errors', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(undefined);

            transportAuth.post('service_group', 'url').catch(noop);
            transportAuth.state = 1;
            fetch.resolve(401, { error: 401, message: 'Authorization exception' });

            setTimeout(() => {
                expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(1);
                done();
            });
        });

        it('blocks re-requesting authorization token after max number of errors occurs', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);

            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(undefined);

            waterfallTimeout([
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });

                    expect(tokenRefreshSpy.mock.calls.length).toEqual(1);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(1);
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });

                    expect(tokenRefreshSpy.mock.calls.length).toEqual(2);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(2);
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });

                    expect(tokenRefreshSpy.mock.calls.length).toEqual(3);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(3);
                },
                () => {
                    // Checking if calls after hitting max limit are blocked.
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(3);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(3);

                    done();
                },
            ]);
        });

        it('doesnt block re-requesting if limit not reached for separate endpoints', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);

            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(undefined);
            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(undefined);

            waterfallTimeout([

                // First group of failed request for specific endpoint url.
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(1);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(2);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(3);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(3);
                },

                // Second group of failed request for different endpoint. tokenRefreshSpy should still be invoked and counter for new endpoint should start from 0.
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(4);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(1);

                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(5);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(2);

                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(6);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(3);

                    done();
                },
            ]);
        });

        it('resets error counters after dispose', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);

            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(undefined);
            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(undefined);

            waterfallTimeout([

                // First group of failed request for specific endpoint url.
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(1);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(2);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(3);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(3);

                    transportAuth.dispose();

                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(undefined);
                    done();
                },
            ]);
        });

        it('resets error counters after debounce timeout is reached', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshSpy = jest.fn().mockName('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);

            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url']).toBe(undefined);
            expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(undefined);

            waterfallTimeout([
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(1);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(2);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(3);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(3);

                    tick(6000);

                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(undefined);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, { error: 401, message: 'Authorization exception' });
                },
                () => {
                    expect(tokenRefreshSpy.mock.calls.length).toEqual(4);
                    expect(transportAuth.authorizationErrorCount['localhost/openapi/service_group/url-2']).toBe(1);
                    done();
                },
            ]);
        });
    });

    describe('incrementErrorCounter', () => {
        it('should increment error count for newly used url', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.incrementErrorCounter('new-url');
            expect(transportAuth.authorizationErrorCount['new-url']).toBe(1);

            transportAuth.incrementErrorCounter('new-url');
            expect(transportAuth.authorizationErrorCount['new-url']).toBe(2);

            transportAuth.incrementErrorCounter('new-url-2');
            expect(transportAuth.authorizationErrorCount['new-url-2']).toBe(1);
        });
    });

    describe('getUrlErrorCount', () => {
        it('should return error count for specific url', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.authorizationErrorCount = {
                'new-url': 5,
                'new-url-2': 2,
            };

            expect(transportAuth.getUrlErrorCount('new-url')).toBe(5);
            expect(transportAuth.getUrlErrorCount('new-url-2')).toBe(2);
        });

        it('should return 0 for url which is not present in error count map', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.authorizationErrorCount = {
                'new-url': 5,
                'new-url-2': 2,
            };

            expect(transportAuth.getUrlErrorCount('new-url-2')).toBe(2);
            expect(transportAuth.getUrlErrorCount('new-url-3')).toBe(0);
            expect(transportAuth.getUrlErrorCount('new-random-name')).toBe(0);
        });
    });
});
