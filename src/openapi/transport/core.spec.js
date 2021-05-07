import mockFetch from '../../test/mocks/fetch';
import { setTimeout, installClock, uninstallClock } from '../../test/utils';
import TransportCore from './core';

describe('openapi TransportCore', () => {
    let transport;
    let fetch;

    beforeEach(() => {
        fetch = mockFetch();
        installClock();
    });

    afterEach(function () {
        uninstallClock();
    });

    describe('parameters', () => {
        it('requires a service path and url', () => {
            transport = new TransportCore('localhost');
            expect(() => transport.get()).toThrow();
            expect(() => transport.get('', '')).toThrow();
            expect(() => transport.get('service_path', '')).toThrow();
            expect(() => transport.get('', 'url')).toThrow();

            expect(() => new TransportCore()).toThrow();
            expect(() => new TransportCore(null, {})).toThrow();
            expect(() => new TransportCore('')).toThrow();
        });
    });

    describe('base selection for on-prem or cloud', () => {
        it('assumes on-prem when given no configuration', () => {
            transport = new TransportCore('localhost');

            transport.get('service_path', 'endpoint');

            expect(fetch).toHaveBeenCalledWith(
                'localhost/openapi/service_path/endpoint',
                expect.anything(),
            );
        });

        it('assumes on-prem for a service path with no configuration', () => {
            transport = new TransportCore('localhost', {
                services: {},
            });

            transport.get('service_path', 'endpoint');

            expect(fetch).toHaveBeenCalledWith(
                'localhost/openapi/service_path/endpoint',
                expect.anything(),
            );
        });

        it('assumes on-prem for a service path with no relevant configuration', () => {
            transport = new TransportCore('localhost', {
                services: {
                    service_path: {},
                },
            });

            transport.get('service_path', 'endpoint');

            expect(fetch).toHaveBeenCalledWith(
                'localhost/openapi/service_path/endpoint',
                expect.anything(),
            );
        });

        it('uses on-prem for a service path configured as such', () => {
            transport = new TransportCore('localhost', {
                services: {
                    service_path: { useCloud: false },
                },
            });

            transport.get('service_path', 'endpoint');

            expect(fetch).toHaveBeenCalledWith(
                'localhost/openapi/service_path/endpoint',
                expect.anything(),
            );
        });

        it('uses cloud for a service path configured as such', () => {
            transport = new TransportCore('localhost', {
                services: {
                    service_path: { useCloud: true },
                },
            });

            transport.get('service_path', 'endpoint');

            expect(fetch).toHaveBeenCalledWith(
                'localhost/oapi/service_path/endpoint',
                expect.anything(),
            );
        });

        it('allows useCloud configuration to be dynamic', () => {
            const useCloud = jest.fn();
            transport = new TransportCore('localhost', {
                services: {
                    service_path: { useCloud },
                },
            });

            useCloud.mockReturnValue(false);
            transport.get('service_path', 'endpoint');

            expect(useCloud).toHaveBeenCalled();
            expect(fetch).toHaveBeenCalledWith(
                'localhost/openapi/service_path/endpoint',
                expect.anything(),
            );

            fetch.mockClear();
            useCloud.mockReturnValue(true);
            transport.get('service_path', 'endpoint');

            expect(useCloud).toHaveBeenCalled();
            expect(fetch).toHaveBeenCalledWith(
                'localhost/oapi/service_path/endpoint',
                expect.anything(),
            );
        });
    });

    describe('url templating', () => {
        it('basically works', () => {
            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info/{user}/{account}', {
                user: 'te',
                account: 'st',
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te/st',
                expect.anything(),
            ]);
            fetch.mockClear();

            transport.get(
                'service_path',
                'account/info/{user}?acc={account}&thingy={thing}',
                { user: 'te', account: 'st', thing: 'ing' },
            );
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te?acc=st&thingy=ing',
                expect.anything(),
            ]);
            fetch.mockClear();
        });

        it('includes multiple query params', () => {
            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info', null, {
                queryParams: { a: 1, b: 2 },
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info?a=1&b=2',
                expect.anything(),
            ]);
            fetch.mockClear();
        });

        it('allows query params option and query params in the template', () => {
            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info?a=1&b=2', null, {
                queryParams: { c: 3, d: 4 },
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info?a=1&b=2&c=3&d=4',
                expect.anything(),
            ]);
            fetch.mockClear();
        });

        it('url encodes template args', () => {
            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info/{user}/{account}', {
                user: 'te ?=!/\\',
                account: String.fromCharCode(160),
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te%20%3F%3D!%2F%5C/%C2%A0',
                expect.anything(),
            ]);
            fetch.mockClear();
        });

        it('url encodes queryParams', () => {
            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info', null, {
                queryParams: { a: '&=' },
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info?a=%26%3D',
                expect.anything(),
            ]);
            fetch.mockClear();
        });
    });

    describe('response code', () => {
        it('rejects a 400 response', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(400, 'Error');

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.catch(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);
                done();
            });
        });
        it('resolves a 200 response', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(200, 'Text');

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.then(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);
                done();
            });
        });
        it('resolves a 304 response', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(304, 'Text');

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.then(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);
                done();
            });
        });
    });

    describe('request body', () => {
        it('get without body should have undefined body', () => {
            // This is quite important test which ensures that we set undefined for body when it's missing for GET requests.
            // Currently EDGE browser will fail if GET requests have for example null body in the request.

            transport = new TransportCore('localhost');
            transport.get('service_path', 'account/info/{user}/{account}', {
                user: 'te',
                account: 'st',
            });

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te/st',
                {
                    body: undefined,
                    method: 'GET',
                    headers: { 'X-Request-Id': expect.any(Number) },
                    // credentials: 'include' adds cookies.
                    // Cookies used by some open api operations. if we don't default here make sure it is sent through with subscription requests.
                    credentials: 'include',
                },
            ]);
        });

        it('allows an object', () => {
            transport = new TransportCore('localhost');
            transport.post(
                'service_path',
                'account/info/{user}/{account}',
                { user: 'te', account: 'st' },
                { body: { Test: true } },
            );

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te/st',
                {
                    body: '{"Test":true}',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Request-Id': expect.any(Number),
                    },
                    // credentials: 'include' adds cookies.
                    // Cookies used by some open api operations. if we don't default here make sure it is sent through with subscription requests.
                    credentials: 'include',
                },
            ]);
        });

        it('allows a string', () => {
            transport = new TransportCore('localhost');
            transport.post(
                'service_path',
                'account/info/{user}/{account}',
                { user: 'te', account: 'st' },
                { body: '{"Test":true}' },
            );

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/service_path/account/info/te/st',
                {
                    body: '{"Test":true}',
                    method: 'POST',
                    headers: { 'X-Request-Id': expect.any(Number) },
                    credentials: 'include',
                },
            ]);
        });

        it('allows a FormData object', () => {
            const file = new window.File(['foo'], 'foo.txt', {
                type: 'text/plain',
            });
            const formData = new window.FormData();
            formData.append('hest', file);
            transport = new TransportCore('localhost');
            transport.post(
                'platform',
                'v1/media/{contentLibraryId}',
                {
                    contentLibraryId: 'fleeb',
                },
                { body: formData },
            );

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/platform/v1/media/fleeb',
                {
                    body: expect.any(window.FormData),
                    method: 'POST',
                    headers: { 'X-Request-Id': expect.any(Number) },
                    credentials: 'include',
                },
            ]);
        });

        it('allows a File/Blob object', () => {
            const file = new window.File(['foo'], 'foo.txt', {
                type: 'text/plain',
            });
            transport = new TransportCore('localhost');
            transport.post(
                'platform',
                'v1/media/{contentLibraryId}',
                {
                    contentLibraryId: 'fleeb',
                },
                { body: file },
            );

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/platform/v1/media/fleeb',
                {
                    body: expect.any(window.Blob),
                    method: 'POST',
                    headers: { 'X-Request-Id': expect.any(Number) },
                    credentials: 'include',
                },
            ]);
        });

        it('allows a URLSearchParams object', () => {
            const paramsString = 'q=URLUtils.searchParams&topic=api';
            const searchParams = new window.URLSearchParams(paramsString);
            transport = new TransportCore('localhost');
            transport.post(
                'platform',
                'v1/media/{contentLibraryId}',
                {
                    contentLibraryId: 'fleeb',
                },
                { body: searchParams },
            );

            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                'localhost/openapi/platform/v1/media/fleeb',
                {
                    body: expect.any(window.URLSearchParams),
                    method: 'POST',
                    headers: { 'X-Request-Id': expect.any(Number) },
                    credentials: 'include',
                },
            ]);
        });
    });

    describe('response data', () => {
        it('gets text from a multipart/mixed', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(200, 'Text', 'multipart/mixed');

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.then(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);

                const res = getSpy.mock.calls[0][0];
                expect(res).toEqual(
                    expect.objectContaining({ status: 200, response: 'Text' }),
                );
                done();
            });
        });

        it('parses a json response', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(200, { Test: true });

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.then(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);

                const res = getSpy.mock.calls[0][0];
                expect(res).toEqual(
                    expect.objectContaining({
                        status: 200,
                        response: { Test: true },
                    }),
                );
                expect(res.headers.get('content-type')).toEqual(
                    'application/json; utf-8',
                );
                done();
            });
        });

        it('parses a json response when a call fails', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(404, { Test: true });

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.catch(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);

                const res = getSpy.mock.calls[0][0];
                expect(res).toEqual(
                    expect.objectContaining({
                        status: 404,
                        response: { Test: true },
                    }),
                );
                expect(res.headers.get('content-type')).toEqual(
                    'application/json; utf-8',
                );
                done();
            });
        });

        it('copes with an exception reject', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.reject(new Error('no properties'));

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.catch(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);
                done();
            });
        });

        it('parses a json response when a call is resolved, but failed due to response status', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(400, { Test: true });

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.catch(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);

                const res = getSpy.mock.calls[0][0];
                expect(res).toEqual(
                    expect.objectContaining({
                        status: 400,
                        response: { Test: true },
                    }),
                );
                expect(res.headers.get('content-type')).toEqual(
                    'application/json; utf-8',
                );
                done();
            });
        });

        it('copes with invalid json', (done) => {
            transport = new TransportCore('localhost');
            const getPromise = transport.get(
                'service_path',
                'account/info',
                null,
            );

            fetch.resolve(200, '{ "test": ', 'application/json; utf-8');

            const getSpy = jest.fn().mockName('getSpy');
            getPromise.then(getSpy);

            setTimeout(() => {
                expect(getSpy.mock.calls.length).toEqual(1);

                const res = getSpy.mock.calls[0][0];
                expect(res).toEqual(
                    expect.objectContaining({
                        status: 200,
                        response: '{ "test": ',
                    }),
                );
                expect(res.headers.get('content-type')).toEqual(
                    'application/json; utf-8',
                );
                done();
            });
        });
    });

    describe('cache', () => {
        function expectItWasAllowingCaching() {
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.stringMatching(/url$/),
                expect.anything(),
            ]);
        }
        function expectItWasNotAllowingCaching() {
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.stringMatching(/url\?_=\d+$/),
                expect.anything(),
            ]);
        }
        it('defaults to true and can be overridden globally and at each call', () => {
            transport = new TransportCore('localhost');
            expect(transport.defaultCache).toEqual(true);

            transport.get('service_path', 'url', null, {});
            expectItWasAllowingCaching();
            fetch.mockClear();

            transport.get('service_path', 'url', null, { cache: false });
            expectItWasNotAllowingCaching();
            fetch.mockClear();

            transport.get('service_path', 'url', null, { cache: true });
            expectItWasAllowingCaching();
            fetch.mockClear();

            transport = new TransportCore('localhost', {
                defaultCache: false,
            });
            expect(transport.defaultCache).toEqual(false);

            transport.get('service_path', 'url', null, {});
            expectItWasNotAllowingCaching();
            fetch.mockClear();

            transport.get('service_path', 'url', null, { cache: false });
            expectItWasNotAllowingCaching();
            fetch.mockClear();

            // test state has not changed
            transport.get('service_path', 'url', null, { cache: true });
            expectItWasAllowingCaching();
            fetch.mockClear();

            transport = new TransportCore('localhost', {
                defaultCache: true,
            });
            expect(transport.defaultCache).toEqual(true);

            transport.get('service_path', 'url', null, {});
            expectItWasAllowingCaching();
            fetch.mockClear();

            transport.get('service_path', 'url', null, { cache: false });
            expectItWasNotAllowingCaching();
            fetch.mockClear();

            // test state has not changed
            transport.get('service_path', 'url', null, { cache: true });
            expectItWasAllowingCaching();
            fetch.mockClear();
        });

        it('copes with a url that already has a param', () => {
            transport = new TransportCore('localhost');
            expect(transport.defaultCache).toEqual(true);

            transport.get('service_path', 'url?param=true', null, {
                cache: false,
            });
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.stringMatching(/url\?param=true&_=\d+$/),
                expect.anything(),
            ]);
        });
    });

    describe('language', () => {
        beforeEach(() => {
            transport = new TransportCore('localhost', {
                language: 'dk',
            });
        });

        afterEach(() => transport.dispose());

        function expectTheLanguageToBeSetTo(assertedLanguage) {
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Accept-Language': assertedLanguage,
                    }),
                }),
            ]);
        }

        it('adds on the language', () => {
            transport.get('service_path', 'url', null, {});
            expectTheLanguageToBeSetTo('dk, *;q=0.5');
            fetch.mockClear();

            transport.put('service_path', 'url', null, null);
            expectTheLanguageToBeSetTo('dk, *;q=0.5');
            fetch.mockClear();

            transport.post('service_path', 'url', null, { headers: null });
            expectTheLanguageToBeSetTo('dk, *;q=0.5');
            fetch.mockClear();

            transport.delete('service_path', 'url', null, { headers: {} });
            expectTheLanguageToBeSetTo('dk, *;q=0.5');
            fetch.mockClear();

            transport.patch('service_path', 'url');
            expectTheLanguageToBeSetTo('dk, *;q=0.5');
            fetch.mockClear();
        });

        it('does not override a custom language', () => {
            transport.get(
                'service_path',
                'url',
                {},
                { headers: { 'Accept-Language': 'en' } },
            );
            expectTheLanguageToBeSetTo('en');
            fetch.mockClear();

            transport.put(
                'service_path',
                'url',
                {},
                { headers: { 'Accept-Language': 'dk' } },
            );
            expectTheLanguageToBeSetTo('dk');
            fetch.mockClear();

            transport.post(
                'service_path',
                'url',
                {},
                { headers: { 'Accept-Language': 'sv' } },
            );
            expectTheLanguageToBeSetTo('sv');
            fetch.mockClear();

            transport.delete(
                'service_path',
                'url',
                {},
                { headers: { 'Accept-Language': 'en' } },
            );
            expectTheLanguageToBeSetTo('en');
            fetch.mockClear();

            transport.patch(
                'service_path',
                'url',
                {},
                { headers: { otherHeader: 'yes', 'Accept-Language': 'en' } },
            );
            expectTheLanguageToBeSetTo('en');
            fetch.mockClear();
        });
    });

    describe('setUseXHttpMethodOverride', () => {
        beforeEach(() => {
            transport = new TransportCore('localhost');
            transport.setUseXHttpMethodOverride(true);
        });

        afterEach(() => transport.dispose());

        it('works', () => {
            transport.get('service_path', 'url', null, {});
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'X-Request-Id': expect.any(Number) },
                }),
            ]);
            fetch.mockClear();

            transport.put('service_path', 'url', null, null);
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'X-HTTP-Method-Override': 'PUT',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            fetch.mockClear();

            transport.post('service_path', 'url', null, { headers: null });
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'X-Request-Id': expect.any(Number) },
                }),
            ]);
            fetch.mockClear();

            transport.delete('service_path', 'url', null, { headers: {} });
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'X-HTTP-Method-Override': 'DELETE',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            fetch.mockClear();

            transport.patch('service_path', 'url');
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'POST',
                    body: '{}',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-HTTP-Method-Override': 'PATCH',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            fetch.mockClear();
        });
    });

    describe('PATCH body defaulting', () => {
        beforeEach(() => {
            transport = new TransportCore('localhost');
        });

        afterEach(() => transport.dispose());

        it('works', () => {
            transport.patch('service_path', 'url', null, {
                body: { exampleField: 'test' },
            });
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({
                    method: 'PATCH',
                    body: '{"exampleField":"test"}',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Request-Id': expect.any(Number),
                    },
                }),
            ]);
            fetch.mockClear();
        });
    });

    describe('abort signal', () => {
        beforeEach(() => {
            transport = new TransportCore('localhost');
        });

        afterEach(() => transport.dispose());

        function expectFetchToBeCalledWith(signal) {
            expect(fetch.mock.calls.length).toEqual(1);
            expect(fetch.mock.calls[0]).toEqual([
                expect.anything(),
                expect.objectContaining({ signal }),
            ]);
        }

        it('passes the abort signal down to fetch', () => {
            const signal = jest.fn().mockName('AbortSignal')

            transport.get('service_path', 'url', null, { signal });
            expectFetchToBeCalledWith(signal);
            fetch.mockClear();

            transport.get('service_path', 'url');
            expectFetchToBeCalledWith(undefined);
            fetch.mockClear();
        });
    });
});
