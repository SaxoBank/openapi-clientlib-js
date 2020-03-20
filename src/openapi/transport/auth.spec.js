import {
    setTimeout,
    tick,
    waterfallTimeout,
    installClock,
    uninstallClock,
} from '../../test/utils';
import mockFetch from '../../test/mocks/fetch';
import TransportAuth from './auth';
import mockAuthProvider from '../../test/mocks/authProvider';

describe('openapi TransportAuth', () => {
    const noop = () => {};
    let transportAuth;
    let fetch;
    let authProvider;

    beforeEach(() => {
        installClock();
        fetch = mockFetch();
        authProvider = mockAuthProvider();
    });
    afterEach(function() {
        uninstallClock();
        if (transportAuth) {
            transportAuth.dispose();
            transportAuth = null;
        }
    });

    it('throws an exception if created without a base url and auth provider', () => {
        expect(() => {
            new TransportAuth();
        }).toThrow();
        expect(() => {
            new TransportAuth('');
        }).toThrow();
        expect(() => {
            new TransportAuth('baseUrl');
        }).toThrow();
        expect(() => {
            new TransportAuth(null, {});
        }).toThrow();
    });

    describe('refreshing', () => {
        it('refreshes the token when a transport call returns a 401', (done) => {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(fetch).not.toBeCalled();
            authProvider.getExpiry.mockImplementation(() => 1);
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            authProvider.getExpiry.mockImplementation(() => 2);
            fetch.resolve(401);

            setTimeout(() => {
                expect(authProvider.tokenRejected).toBeCalledTimes(1);
                expect(authProvider.tokenRejected).toHaveBeenCalledWith(1);
                done();
            });
        });

        it('does nothing when a transport call fails with a different error code', (done) => {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(402);

            setTimeout(() => {
                expect(authProvider.tokenRejected).not.toBeCalled();
                done();
            });
        });
    });

    describe('transport', function() {
        it('adds on a auth header when methods are called', function() {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_group', 'url');
            expect(fetch).toBeCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            );
            fetch.mockClear();

            transportAuth.get('service_group', 'url', {}, {});
            expect(fetch).toBeCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            );
        });

        it('supports all the http verbs', function() {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            transportAuth.get('service_group', 'url');
            transportAuth.put('service_group', 'url');
            transportAuth.post('service_group', 'url');
            transportAuth.patch('service_group', 'url');
            transportAuth.delete('service_group', 'url');
            expect(fetch).toBeCalledTimes(5);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            expect(fetch.mock.calls[1]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            expect(fetch.mock.calls[2]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            expect(fetch.mock.calls[3]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                        'Content-Type': expect.any(String),
                    },
                }),
            ]);
            expect(fetch.mock.calls[4]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
        });

        it('overrides an auth header if one exists', function() {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(fetch).not.toBeCalled();
            transportAuth.get(
                'service_group',
                'url',
                {},
                { headers: { Authorization: 'MYTOKEN' } },
            );
            expect(fetch).toBeCalledTimes(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: {
                        Authorization: 'Bearer TOKEN',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
        });

        it('counts transport authorization errors', function(done) {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url'
                ],
            ).toBe(undefined);

            transportAuth.post('service_group', 'url').catch(noop);
            transportAuth.state = 1;
            fetch.resolve(401, {
                error: 401,
                message: 'Authorization exception',
            });

            setTimeout(() => {
                expect(
                    transportAuth.authorizationErrorCount[
                        'localhost/openapi/service_group/url'
                    ],
                ).toBe(1);
                done();
            });
        });

        it('blocks re-requesting authorization token after max number of errors occurs', function(done) {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });

                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(1);
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });

                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(2);
                },
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });

                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(3);
                },
                () => {
                    // Checking if calls after hitting max limit are blocked.
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(3);
                },
                () => {
                    // and the time after the max is still blocked
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(3);

                    done();
                },
            ]);
        });

        it('doesnt block re-requesting if limit not reached for separate endpoints', function(done) {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                // First group of failed request for specific endpoint url.
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(3);
                },

                // Second group of failed request for different endpoint. tokenRefreshSpy should still be invoked and counter for new endpoint should start from 0.
                () => {
                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(4);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(1);

                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(5);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(2);

                    transportAuth.post('service_group', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(6);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url'
                        ],
                    ).toBe(3);

                    done();
                },
            ]);
        });

        it('resets error counters after dispose', function(done) {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                // First group of failed request for specific endpoint url.
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(3);

                    transportAuth.dispose();

                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(undefined);
                    done();
                },
            ]);
        });

        it('resets error counters after debounce timeout is reached', function(done) {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrorCount[
                    'localhost/openapi/service_group/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                () => {
                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(1);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(2);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(3);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(3);

                    tick(6000);

                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(undefined);

                    transportAuth.post('service_group', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(4);
                    expect(
                        transportAuth.authorizationErrorCount[
                            'localhost/openapi/service_group/url-2'
                        ],
                    ).toBe(1);
                    done();
                },
            ]);
        });
    });

    describe('incrementErrorCounter', () => {
        it('should increment error count for newly used url', () => {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

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
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

            transportAuth.authorizationErrorCount = {
                'new-url': 5,
                'new-url-2': 2,
            };

            expect(transportAuth.getUrlErrorCount('new-url')).toBe(5);
            expect(transportAuth.getUrlErrorCount('new-url-2')).toBe(2);
        });

        it('should return 0 for url which is not present in error count map', () => {
            transportAuth = new TransportAuth(
                'localhost/openapi',
                authProvider,
            );

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
