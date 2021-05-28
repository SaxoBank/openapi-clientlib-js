import {
    setTimeout,
    tick,
    waterfallTimeout,
    installClock,
    uninstallClock,
} from '../../test/utils';
import mockFetch from '../../test/mocks/fetch';
import mockAuthProvider from '../../test/mocks/authProvider';
import TransportAuth from './auth';

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
    afterEach(function () {
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
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(fetch).not.toBeCalled();
            authProvider.getExpiry.mockImplementation(() => 1);
            transportAuth.get('service_path', 'url').catch(noop);
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
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_path', 'url').catch(noop);
            expect(fetch).toBeCalledTimes(1);
            fetch.mockClear();

            fetch.resolve(402);

            setTimeout(() => {
                expect(authProvider.tokenRejected).not.toBeCalled();
                done();
            });
        });
    });

    describe('transport', function () {
        it('adds on a auth header when methods are called', function () {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(fetch).not.toBeCalled();
            transportAuth.get('service_path', 'url');
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

            transportAuth.get('service_path', 'url', {}, {});
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

        it('supports all the http verbs', function () {
            transportAuth = new TransportAuth('localhost', authProvider);

            transportAuth.get('service_path', 'url');
            transportAuth.put('service_path', 'url');
            transportAuth.post('service_path', 'url');
            transportAuth.patch('service_path', 'url');
            transportAuth.delete('service_path', 'url');
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

        it('overrides an auth header if one exists', function () {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(fetch).not.toBeCalled();
            transportAuth.get(
                'service_path',
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

        it('counts transport authorization errors', function (done) {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url'
                ],
            ).toBe(undefined);

            transportAuth.post('service_path', 'url').catch(noop);
            transportAuth.state = 1;
            fetch.resolve(401, {
                error: 401,
                message: 'Authorization exception',
            });

            setTimeout(() => {
                expect(
                    transportAuth.authorizationErrors[
                        'localhost/openapi/service_path/url'
                    ],
                ).toEqual([expect.any(Object)]);
                done();
            });
        });

        it('blocks re-requesting authorization token if auth errors happen on different tokens', function (done) {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url'
                ],
            ).toBe(undefined);

            const catchError = jest.fn();

            return waterfallTimeout([
                () => {
                    authProvider.getExpiry.mockImplementation(() => 1);
                    transportAuth.post('service_path', 'url').catch(catchError);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url'
                        ],
                    ).toEqual([expect.any(Object)]);
                },
                () => {
                    authProvider.getExpiry.mockImplementation(() => 2);
                    transportAuth.post('service_path', 'url').catch(catchError);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url'
                        ],
                    ).toEqual([expect.any(Object), expect.any(Object)]);
                    expect(catchError).toHaveBeenCalledTimes(2);
                    expect(catchError.mock.calls).toMatchInlineSnapshot(`
                        Array [
                          Array [
                            Object {
                              "headers": Object {
                                "get": [Function],
                              },
                              "response": Object {
                                "error": 401,
                                "message": "Authorization exception",
                              },
                              "responseType": "json",
                              "size": 49,
                              "status": 401,
                              "url": "localhost/openapi/service_path/url",
                            },
                          ],
                          Array [
                            Object {
                              "isNetworkError": false,
                              "message": "Auth overload",
                            },
                          ],
                        ]
                    `);

                    done();
                },
            ]);
        });

        it('doesnt block re-requesting if limit not reached for separate endpoints', function (done) {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                // Fail the first endpoint
                () => {
                    authProvider.getExpiry.mockImplementation(() => 1);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    authProvider.getExpiry.mockImplementation(() => 2);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url'
                        ],
                    ).toEqual([expect.any(Object), expect.any(Object)]);
                },
                // now have a failure with the new endpoint
                () => {
                    authProvider.getExpiry.mockImplementation(() => 3);
                    transportAuth.post('service_path', 'url-2').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);
                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url-2'
                        ],
                    ).toEqual([expect.any(Object)]);

                    done();
                },
            ]);
        });

        it('resets error counters after dispose', function (done) {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                () => {
                    authProvider.getExpiry.mockImplementation(() => 1);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    authProvider.getExpiry.mockImplementation(() => 2);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(1);
                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url'
                        ],
                    ).toEqual(expect.any(Array));

                    transportAuth.dispose();

                    expect(
                        transportAuth.authorizationErrors[
                            'localhost/openapi/service_path/url'
                        ],
                    ).toBe(undefined);

                    done();
                },
            ]);
        });

        it('resets error counters after debounce timeout is reached', function (done) {
            transportAuth = new TransportAuth('localhost', authProvider);

            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url'
                ],
            ).toBe(undefined);
            expect(
                transportAuth.authorizationErrors[
                    'localhost/openapi/service_path/url-2'
                ],
            ).toBe(undefined);

            waterfallTimeout([
                () => {
                    authProvider.getExpiry.mockImplementation(() => 1);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    tick(30001);

                    authProvider.getExpiry.mockImplementation(() => 2);
                    transportAuth.post('service_path', 'url').catch(noop);
                    transportAuth.state = 1;
                    fetch.resolve(401, {
                        error: 401,
                        message: 'Authorization exception',
                    });
                },
                () => {
                    expect(authProvider.tokenRejected).toHaveBeenCalledTimes(2);

                    done();
                },
            ]);
        });
    });

    describe('areUrlAuthErrorsProblematic', () => {
        it('should return value for specific url', () => {
            transportAuth = new TransportAuth('localhost', authProvider);

            transportAuth.authorizationErrors = {
                'new-url': [{ authExpiry: 1 }],
                'new-url-2': [{ authExpiry: 1 }, { authExpiry: 2 }],
            };

            expect(
                transportAuth.areUrlAuthErrorsProblematic('new-url', 1),
            ).toBe(false);
            expect(
                transportAuth.areUrlAuthErrorsProblematic('new-url-2', 1),
            ).toBe(true);
            expect(
                transportAuth.areUrlAuthErrorsProblematic('new-url-2', 3),
            ).toBe(true);
        });

        it('should return true for url which is not present in errors map', () => {
            transportAuth = new TransportAuth('localhost', authProvider);

            transportAuth.authorizationErrors = {
                'new-url': [{ authExpiry: 1 }],
                'new-url-2': [{ authExpiry: 1 }, { authExpiry: 2 }],
            };

            expect(
                transportAuth.areUrlAuthErrorsProblematic('new-url-1', 1),
            ).toBe(false);
        });
    });
});
