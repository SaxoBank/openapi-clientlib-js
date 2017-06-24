import { tick, installClock, uninstallClock } from '../../utils';
import mockFetch from '../../mocks/fetch';

const TransportAuth = saxo.openapi.TransportAuth;

describe('openapi TransportAuth', () => {

    let transportAuth;
    let fetch;

    beforeEach(() => {
        fetch = mockFetch();
        installClock();
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

            const tokenRefreshSpy = jasmine.createSpy('tokenRefresh listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            transportAuth.auth.set('TOK2', relativeDate(0));
            transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH, tokenRefreshSpy);
            expect(tokenRefreshSpy.calls.count()).toEqual(1);

            transportAuth.auth.set('TOK3', relativeDate(0));
            expect(tokenRefreshSpy.calls.count()).toEqual(1);
        });
        it('fires an event when receiving a new token', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenReceivedSpy = jasmine.createSpy('tokenReceived listener');
            const tokenRefreshFailSpy = jasmine.createSpy('tokenRefreshFail listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
            transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
            transportAuth.auth.set('TOK2', relativeDate(0));
            fetch.resolve('200', { token: 'TOK3', expiry: 60 });
            tick(function() {
                transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.off(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                expect(tokenReceivedSpy.calls.count()).toEqual(1);

                transportAuth.auth.set('TOK4', relativeDate(0));
                fetch.resolve('200', { token: 'TOK5', expiry: 60 });
                tick(function() {
                    expect(tokenReceivedSpy.calls.count()).toEqual(1);
                    expect(tokenRefreshFailSpy.calls.count()).toEqual(0);
                    done();
                });
            });
        });
        it('fires an event when token refreshing failed', function(done) {
            const options = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', options);

            const tokenRefreshFailSpy = jasmine.createSpy('tokenRefreshFail listener');
            const tokenReceivedSpy = jasmine.createSpy('tokenReceived listener');
            transportAuth.on(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
            transportAuth.on(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
            transportAuth.auth.set('TOK2', relativeDate(0));
            fetch.reject('401', { error: 'not authorised' });
            tick(function() {
                transportAuth.off(transportAuth.EVENT_TOKEN_REFRESH_FAILED, tokenRefreshFailSpy);
                transportAuth.off(transportAuth.EVENT_TOKEN_RECEIVED, tokenReceivedSpy);
                expect(tokenRefreshFailSpy.calls.count()).toEqual(1);

                transportAuth.auth.set('TOK4', relativeDate(0));
                fetch.reject('401', { error: 'not authorised' });
                tick(function() {
                    expect(tokenRefreshFailSpy.calls.count()).toEqual(1);
                    expect(tokenReceivedSpy.calls.count()).toEqual(0);
                    done();
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
            expect(fetch.calls.count()).toEqual(1);
            expect(fetch.calls.argsFor(0)).toEqual(['http://refresh', jasmine.objectContaining({ method: 'POST' })]);
        });

        it('refreshes immediately if the token is out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(transportAuth.isAuthorised).toEqual(false);
            expect(fetch.calls.count()).toEqual(1);
            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(transportAuth.auth.getExpiry()).toEqual(initialOptions.expiry);

            expect(fetch.calls.first().args[0]).toEqual('http://refresh');
            expect(fetch.calls.first().args[1].method).toEqual('POST');

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            tick(function() {
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

            expect(fetch.calls.count()).toEqual(1);
            expect(fetch.calls.argsFor(0)).toEqual(jasmine.anything(), jasmine.objectContaining({ headers: expectedHeaders }));
        });

        it('includes the headers passed in as options and does not override content-type', () => {
            const expectedHeaders = { foo: 'bar', 'Content-Type': 'JSON' };
            const headersOption = expectedHeaders;

            const initialOptions = { token: 'TOKEN', expiry: relativeDate(-1), tokenRefreshUrl: 'http://refresh', tokenRefreshHeaders: headersOption };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(1);
            expect(fetch.calls.argsFor(0)).toEqual(jasmine.anything(), jasmine.objectContaining({ headers: expectedHeaders }));
        });

        it('refreshes when the token becomes out of date', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);
            expect(fetch.calls.count()).toEqual(0);

            jasmine.clock().tick(10000);

            expect(transportAuth.isAuthorised).toEqual(true);
            expect(fetch.calls.count()).toEqual(1);
            expect(transportAuth.auth.getToken()).toEqual('Bearer ' + initialOptions.token);
            expect(transportAuth.auth.getExpiry()).toEqual(initialOptions.expiry);

            fetch.resolve('200', { token: 'TOK2', expiry: 60 });
            tick(function() {
                expect(transportAuth.auth.getToken()).toEqual('Bearer TOK2');

                jasmine.clock().tick(60000);

                expect(transportAuth.isAuthorised).toEqual(true);
                expect(fetch.calls.count()).toEqual(2);
                expect(transportAuth.auth.getToken()).toEqual('Bearer TOK2');

                fetch.resolve('200', { token: 'TOK3', expiry: 60 });
                tick(function() {
                    expect(transportAuth.isAuthorised).toEqual(true);
                    expect(transportAuth.auth.getToken()).toEqual('Bearer TOK3');
                    done();
                });
            });
        });

        it('retries if the auth refresh fails', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh', retryDelayMs: 599, maxRetryCount: 1 };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            jasmine.clock().tick(10000);

            expect(fetch.calls.count()).toEqual(1);
            fetch.reject(400);

            tick(() => {
                expect(fetch.calls.count()).toEqual(1);

                jasmine.clock().tick(598);
                tick(() => {
                    expect(fetch.calls.count()).toEqual(2);
                    fetch.reject(400);

                    jasmine.clock().tick(10000);
                    tick(() => {
                        expect(fetch.calls.count()).toEqual(2); // stops retrying because maxRetry is 1
                        done();
                    });
                });
            });
        });

        it('when refresh token is called it doesn\'t still refresh the token when it becomes expired before the call returns', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);
            expect(fetch.calls.count()).toEqual(0);

            jasmine.clock().tick(9999);
            expect(fetch.calls.count()).toEqual(0);
            transportAuth.refreshOpenApiToken();
            expect(fetch.calls.count()).toEqual(1);
            jasmine.clock().tick(100000);
            expect(fetch.calls.count()).toEqual(1);
        });

        it('refreshes the token when a transport call returns a 401', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            fetch.calls.reset();

            fetch.resolve(401);

            tick(() => {
                expect(fetch.calls.count()).toEqual(1);
                done();
            });
        });

        it('does nothing when a transport call fails with a different error code', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            fetch.calls.reset();

            fetch.resolve(402);

            tick(() => {
                expect(fetch.calls.count()).toEqual(0);
                done();
            });
        });

        it('does nothing when a transport call returns a 401 and it is already refreshing', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            jasmine.clock().tick(9999);
            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            fetch.calls.reset();

            jasmine.clock().tick(10000); // will trigger a refresh

            tick(() => {
                expect(fetch.calls.count()).toEqual(1);
                fetch.resolve(401); // shouldn't trigger a refresh

                tick(() => {
                    expect(fetch.calls.count()).toEqual(1);
                    done();
                });
            });
        });

        it('does nothing when a transport call returns a 401 and it is refresh retrying', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.get('service_group', 'url');
            const getResolve = fetch.resolve;
            fetch.calls.reset();

            jasmine.clock().tick(10000);
            expect(fetch.calls.count()).toEqual(1);
            fetch.reject();

            tick(() => {

                expect(fetch.calls.count()).toEqual(1);
                // should be waiting to retry again

                getResolve(401);
                expect(fetch.calls.count()).toEqual(1);

                tick(() => {
                    expect(fetch.calls.count()).toEqual(1);

                    jasmine.clock().tick(1000);

                    tick(() => {
                        expect(fetch.calls.count()).toEqual(2);
                        done();
                    });
                });
            });
        });

        it('refreshes the token once when multiple transport calls return a 401', (done) => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(10), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            fetch.calls.reset();

            fetch.resolve(401);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            fetch.calls.reset();

            fetch.resolve(401);

            tick(() => {
                expect(fetch.calls.count()).toEqual(1);
                done();
            });
        });

        it('does nothing if the token is in date', () => {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
        });
    });

    describe('auth transport', function() {
        it('adds on a auth header when methods are called', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url');
            expect(fetch.calls.count()).toEqual(1);
            expect(fetch).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } }));
            fetch.calls.reset();

            transportAuth.get('service_group', 'url', {}, {});
            expect(fetch.calls.count()).toEqual(1);
            expect(fetch).toHaveBeenCalledWith(jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } }));
        });

        it('supports all the http verbs', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            transportAuth.get('service_group', 'url');
            transportAuth.put('service_group', 'url');
            transportAuth.post('service_group', 'url');
            transportAuth.patch('service_group', 'url');
            transportAuth.delete('service_group', 'url');
            expect(fetch.calls.count()).toEqual(5);
            expect(fetch.calls.argsFor(0)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
            expect(fetch.calls.argsFor(1)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
            expect(fetch.calls.argsFor(2)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
            expect(fetch.calls.argsFor(3)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
            expect(fetch.calls.argsFor(4)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
        });

        it('overrides an auth header if one exists', function() {
            const initialOptions = { token: 'TOKEN', expiry: relativeDate(60), tokenRefreshUrl: 'http://refresh' };
            transportAuth = new TransportAuth('localhost/openapi', initialOptions);

            expect(fetch.calls.count()).toEqual(0);
            transportAuth.get('service_group', 'url', {}, { headers: { Authorization: 'MYTOKEN' } });
            expect(fetch.calls.count()).toEqual(1);
            expect(fetch.calls.argsFor(0)).toEqual([jasmine.anything(), jasmine.objectContaining({ headers: { Authorization: 'Bearer TOKEN' } })]);
        });
    });
});
