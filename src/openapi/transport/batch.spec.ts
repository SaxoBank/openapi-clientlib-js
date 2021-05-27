/* eslint-disable max-len */
import {
    setTimeout,
    multiline,
    installClock,
    uninstallClock,
    tick,
} from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import * as RequestUtils from '../../utils/request';
import TransportBatch from './batch';

jest.mock('../../utils/function', () => {
    return {
        nextTick(fn: () => void) {
            global.setTimeout(fn, 0);
        },
    };
});

describe('openapi TransportBatch', () => {
    const validBaseUrl = 'localhost/';
    let transport: any;
    let transportBatch;

    beforeEach(() => {
        RequestUtils.resetCounter();
        transport = mockTransport();
        installClock();

        jest.spyOn(Math, 'random').mockReturnValue(0.1);

        // @ts-ignore
        global.location = {
            host: 'localhost',
        };
        // @ts-ignore
        global.crypto = {
            getRandomValues: jest.fn(),
        };
    });
    afterEach(() => uninstallClock());

    it('requires baseUrl', () => {
        expect(function () {
            transportBatch = new TransportBatch(transport, null, {
                timeoutMs: 0,
            });
        }).toThrow();
        expect(function () {
            // @ts-expect-error testing invalid argument
            transportBatch = new TransportBatch(null, validBaseUrl, {});
        }).toThrow();
        expect(function () {
            transportBatch = new TransportBatch(transport, validBaseUrl, {});
        }).not.toThrow();
        expect(function () {
            transportBatch = new TransportBatch(transport, validBaseUrl, null);
        }).not.toThrow();
        expect(function () {
            transportBatch = new TransportBatch(transport, validBaseUrl);
        }).not.toThrow();
    });

    it("handles different base url's", function () {
        // for this to be valid, open api would have to be hosted at the same level or above on the current server
        expect(() => {
            transportBatch = new TransportBatch(transport, '/');
            expect(transportBatch.timeoutMs).toEqual(0);
        }).toThrow();

        transportBatch = new TransportBatch(transport, 'localhost');
        expect(transportBatch.basePath).toEqual('/openapi/');

        transportBatch = new TransportBatch(transport, 'localhost/foo');
        expect(transportBatch.basePath).toEqual('/foo/openapi/');

        transportBatch = new TransportBatch(transport, 'localhost/foo/');
        expect(transportBatch.basePath).toEqual('/foo/openapi/');

        transportBatch = new TransportBatch(transport, 'http://localhost/foo/');
        expect(transportBatch.basePath).toEqual('/foo/openapi/');
    });

    it('defaults to timeout 0', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl);
        expect(transportBatch.timeoutMs).toEqual(0);
    });

    it('overrides timeout', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 9999,
        });
        expect(transportBatch.timeoutMs).toEqual(9999);
    });

    it('does not batch if only a single call is to be made', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        expect(transport.get.mock.calls.length).toEqual(0);
        expect(transport.post.mock.calls.length).toEqual(0);

        tick(1);

        expect(transport.get.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls.length).toEqual(0);
    });

    it('does not batch calls to services configured to use cloud', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            services: {
                'usersettings/v2': { useCloud: true },
            },
        });

        transportBatch.get('usersettings/v2', 'common');

        expect(transport.get.mock.calls.length).toEqual(1);
    });

    it('batches calls to services configured to use on-prem', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
            services: {
                'usersettings/v2': { useCloud: false },
            },
        });

        transportBatch.get('usersettings/v2', 'common');
        expect(transport.get.mock.calls.length).toEqual(0);

        tick(1);
        expect(transport.get.mock.calls.length).toEqual(1);
    });

    it('queues up calls immediately if timeout is 0', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.patch(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        expect(transport.get.mock.calls.length).toEqual(0);
        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.post.mock.calls.length).toEqual(0);
        expect(transport.delete.mock.calls.length).toEqual(0);
        expect(transport.patch.mock.calls.length).toEqual(0);

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:2',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'PUT /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:3',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'POST /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:4',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'DELETE /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:5',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'PATCH /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:6',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);

        expect(transport.get.mock.calls.length).toEqual(0);
        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.delete.mock.calls.length).toEqual(0);
        expect(transport.patch.mock.calls.length).toEqual(0);
    });

    it('queues up calls and executes after the timeout if the timeout is not 0', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 10,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        tick(5);

        transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        tick(9);

        expect(transport.get.mock.calls.length).toEqual(0);
        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.delete.mock.calls.length).toEqual(0);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:2',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'PUT /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:3',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'POST /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:4',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'DELETE /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:5',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);
    });

    it('accepts an object or a string in the body argument', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
            { body: { test: true, str: 'str' } },
        );
        transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518825, Type: 'CfdOnFutures' },
            { body: '{ "test": true, "str": "str" }' },
        );

        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.post.mock.calls.length).toEqual(0);

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'PUT /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:2',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '{"test":true,"str":"str"}',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'PUT /openapi/port/ref/v1/instruments/details/1518825/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:3',
                    'Content-Type:application/json; charset=utf-8',
                    'Host:localhost',
                    '',
                    '{ "test": true, "str": "str" }',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);

        expect(transport.put.mock.calls.length).toEqual(0);
    });

    it('appends extended asset types header if found in at least one subrequest', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
            { headers: { MyHeader: 'true' } },
        );
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518825, Type: 'CfdOnFutures' },
            { headers: { Pragma: 'oapi-x-extasset' } },
        );

        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.post.mock.calls.length).toEqual(0);

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: {
                    'Content-Type': 'multipart/mixed; boundary="+"',
                    Pragma: 'oapi-x-extasset',
                },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:2',
                    'MyHeader:true',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518825/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:3',
                    'Pragma:oapi-x-extasset',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);

        expect(transport.get.mock.calls.length).toEqual(0);
    });

    it('allows not having any authentication passed in and picks it up off the calls', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
            { headers: { Authorization: 'TOKEN1', MyHeader: 'true' } },
        );
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518825, Type: 'CfdOnFutures' },
            { headers: { Authorization: 'TOKEN2' } },
        );

        expect(transport.put.mock.calls.length).toEqual(0);
        expect(transport.post.mock.calls.length).toEqual(0);

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:2',
                    'Authorization:TOKEN1',
                    'MyHeader:true',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518825/CfdOnFutures HTTP/1.1',
                    'X-Request-Id:3',
                    'Authorization:TOKEN2',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);

        expect(transport.get.mock.calls.length).toEqual(0);
    });

    it('processes the batch response', function (done) {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        const getPromise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 33, Type: 'CfdOnFutures' },
        );
        const putPromise = transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 44, Type: 'CfdOnFutures' },
        );
        const postPromise = transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 55, Type: 'CfdOnFutures' },
        );
        const deletePromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 66, Type: 'CfdOnFutures' },
        );
        const patchPromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 77, Type: 'CfdOnFutures' },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        transport.postResolve({
            status: 200,
            response: multiline(
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 200 OK',
                'Location: ',
                'X-Request-Id:2',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "get"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 200 Okay',
                'Location: ',
                'X-Request-Id:3',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "put"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 201 Created',
                'Location: ',
                'X-Request-Id:4',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "post"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 200 Okay',
                'Location: ',
                'X-Request-Id:5',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "delete"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 200 Okay',
                'Location: ',
                'X-Request-Id:6',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "patch"}',
                '--+--',
                '',
            ),
        });

        const getThen = jest.fn().mockName('getThen');
        const putThen = jest.fn().mockName('putThen');
        const postThen = jest.fn().mockName('postThen');
        const deleteThen = jest.fn().mockName('deleteThen');
        const patchThen = jest.fn().mockName('deleteThen');

        getPromise.then(getThen);
        putPromise.then(putThen);
        postPromise.then(postThen);
        deletePromise.then(deleteThen);
        patchPromise.then(patchThen);

        tick(1);

        setTimeout(() => {
            expect(getThen.mock.calls.length).toEqual(1);
            expect(getThen.mock.calls[0]).toEqual([
                { status: 200, response: { mydata: 'get' } },
            ]);

            expect(putThen.mock.calls.length).toEqual(1);
            expect(putThen.mock.calls[0]).toEqual([
                { status: 200, response: { mydata: 'put' } },
            ]);

            expect(postThen.mock.calls.length).toEqual(1);
            expect(postThen.mock.calls[0]).toEqual([
                { status: 201, response: { mydata: 'post' } },
            ]);

            expect(deleteThen.mock.calls.length).toEqual(1);
            expect(deleteThen.mock.calls[0]).toEqual([
                { status: 200, response: { mydata: 'delete' } },
            ]);

            expect(patchThen.mock.calls.length).toEqual(1);
            expect(patchThen.mock.calls[0]).toEqual([
                { status: 200, response: { mydata: 'patch' } },
            ]);

            done();
        });
    });

    it('passes on failures', function (done) {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        const getPromise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const putPromise = transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const postPromise = transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const deletePromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const patchPromise = transportBatch.patch(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        transport.postReject({ status: 400 });

        const getCatch = jest.fn().mockName('getCatch');
        const putCatch = jest.fn().mockName('putCatch');
        const postCatch = jest.fn().mockName('postCatch');
        const deleteCatch = jest.fn().mockName('deleteCatch');
        const patchCatch = jest.fn().mockName('patchCatch');

        getPromise.catch(getCatch);
        putPromise.catch(putCatch);
        postPromise.catch(postCatch);
        deletePromise.catch(deleteCatch);
        patchPromise.catch(patchCatch);

        tick(1);

        setTimeout(() => {
            // we reject the promise with nothing, which somes through as undefined.
            // put in here in case it changes and we decide to reject with something
            expect(getCatch.mock.calls.length).toEqual(1);
            expect(getCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(putCatch.mock.calls.length).toEqual(1);
            expect(putCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(postCatch.mock.calls.length).toEqual(1);
            expect(postCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(deleteCatch.mock.calls.length).toEqual(1);
            expect(deleteCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(patchCatch.mock.calls.length).toEqual(1);
            expect(patchCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            done();
        });
    });

    it('passes on network errors', function (done) {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        const getPromise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const putPromise = transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const postPromise = transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const deletePromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );
        const patchPromise = transportBatch.patch(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            {
                InstrumentId: 1518824,
                Type: 'CfdOnFutures',
            },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        transport.postReject({ isNetworkError: true });

        const getCatch = jest.fn().mockName('getCatch');
        const putCatch = jest.fn().mockName('putCatch');
        const postCatch = jest.fn().mockName('postCatch');
        const deleteCatch = jest.fn().mockName('deleteCatch');
        const patchCatch = jest.fn().mockName('patchCatch');

        getPromise.catch(getCatch);
        putPromise.catch(putCatch);
        postPromise.catch(postCatch);
        deletePromise.catch(deleteCatch);
        patchPromise.catch(patchCatch);

        tick(1);

        setTimeout(() => {
            // we reject the promise with nothing, which somes through as undefined.
            // put in here in case it changes and we decide to reject with something
            expect(getCatch.mock.calls.length).toEqual(1);
            expect(getCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: true },
            ]);

            expect(putCatch.mock.calls.length).toEqual(1);
            expect(putCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: true },
            ]);

            expect(postCatch.mock.calls.length).toEqual(1);
            expect(postCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: true },
            ]);

            expect(deleteCatch.mock.calls.length).toEqual(1);
            expect(deleteCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: true },
            ]);

            expect(patchCatch.mock.calls.length).toEqual(1);
            expect(patchCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: true },
            ]);

            done();
        });
    });

    it('passes on a failure when the promise resolves without a batch', function (done) {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        const getPromise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const putPromise = transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const postPromise = transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const deletePromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const patchPromise = transportBatch.patch(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        transport.postResolve({
            status: 200,
            response: '',
        });

        const getCatch = jest.fn().mockName('getCatch');
        const putCatch = jest.fn().mockName('putCatch');
        const postCatch = jest.fn().mockName('postCatch');
        const deleteCatch = jest.fn().mockName('deleteCatch');
        const patchCatch = jest.fn().mockName('patchCatch');

        getPromise.catch(getCatch);
        putPromise.catch(putCatch);
        postPromise.catch(postCatch);
        deletePromise.catch(deleteCatch);
        patchPromise.catch(patchCatch);

        tick(1);

        setTimeout(() => {
            expect(getCatch.mock.calls.length).toEqual(1);
            expect(getCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(putCatch.mock.calls.length).toEqual(1);
            expect(deleteCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(postCatch.mock.calls.length).toEqual(1);
            expect(postCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(deleteCatch.mock.calls.length).toEqual(1);
            expect(deleteCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            expect(patchCatch.mock.calls.length).toEqual(1);
            expect(patchCatch.mock.calls[0]).toEqual([
                { message: 'batch failed', isNetworkError: false },
            ]);

            done();
        });
    });

    it('detects a non 2xx status code as a rejection', function (done) {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        const getPromise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const get304Promise = transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const putPromise = transportBatch.put(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const postPromise = transportBatch.post(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const deletePromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );
        const patchPromise = transportBatch.delete(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: 'CfdOnFutures' },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);

        transport.postResolve({
            status: 200,
            response: multiline(
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 199 Some Error',
                'Location: ',
                'X-Request-Id:2',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/text; charset=utf-8',
                '',
                'Some error',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 304 Not Modified',
                'Location: ',
                'X-Request-Id:3',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                '',
                '',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 300 Multiple Choices',
                'Location: ',
                'X-Request-Id:4',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "put"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                // eslint-disable-next-line max-lines
                'HTTP/1.1 299 Edge Case',
                'Location: ',
                'X-Request-Id:5',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "post"}',
                '--+',
                'Content-Type:application/http; msgtype=response',
                '',
                'HTTP/1.1 400 Error',
                'Location: ',
                'X-Request-Id:6',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type:application/json; charset=utf-8',
                '',
                '{ "mydata": "delete"}',
                '--+--',
                '',
            ),
        });

        const getCatch = jest.fn().mockName('getCatch');
        const get304Then = jest.fn().mockName('get304Then');
        const putCatch = jest.fn().mockName('putCatch');
        const postThen = jest.fn().mockName('postThen');
        const deleteCatch = jest.fn().mockName('deleteCatch');
        const patchCatch = jest.fn().mockName('patchCatch');

        getPromise.catch(getCatch);
        get304Promise.then(get304Then);
        putPromise.catch(putCatch);
        postPromise.then(postThen);
        deletePromise.catch(deleteCatch);
        patchPromise.catch(patchCatch);

        tick(1);

        setTimeout(() => {
            // we reject the promise with nothing, which somes through as undefined.
            // put in here in case it changes and we decide to reject with something
            expect(getCatch.mock.calls.length).toEqual(1);
            expect(getCatch.mock.calls[0]).toEqual([{ status: 199 }]);

            expect(get304Then.mock.calls.length).toEqual(1);
            expect(get304Then.mock.calls[0]).toEqual([{ status: 304 }]);

            expect(putCatch.mock.calls.length).toEqual(1);
            expect(putCatch.mock.calls[0]).toEqual([
                { status: 300, response: { mydata: 'put' } },
            ]);

            expect(postThen.mock.calls.length).toEqual(1);
            expect(postThen.mock.calls[0]).toEqual([
                { status: 299, response: { mydata: 'post' } },
            ]);

            expect(deleteCatch.mock.calls.length).toEqual(1);
            expect(deleteCatch.mock.calls[0]).toEqual([
                { status: 400, response: { mydata: 'delete' } },
            ]);

            // patch is testing what happens when openapi doesn't include the item in the response
            expect(patchCatch.mock.calls.length).toEqual(1);
            expect(patchCatch.mock.calls[0]).toEqual([undefined]);

            done();
        });
    });

    it('uri-encodes arguments', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518824, Type: '&=' },
        );
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}/{Type}',
            { InstrumentId: 1518825, Type: '&=' },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824/%26%3D HTTP/1.1',
                    'X-Request-Id:2',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518825/%26%3D HTTP/1.1',
                    'X-Request-Id:3',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);
    });

    it('supports queryParams', function () {
        transportBatch = new TransportBatch(transport, validBaseUrl, {
            timeoutMs: 0,
        });
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}',
            { InstrumentId: 1518824 },
            { queryParams: { a: 1, b: 2 } },
        );
        transportBatch.get(
            'port',
            'ref/v1/instruments/details/{InstrumentId}',
            { InstrumentId: 1518825 },
            { queryParams: { a: '&=' } },
        );

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(1);
        expect(transport.post.mock.calls[0]).toEqual([
            'port',
            'batch',
            null,
            {
                headers: { 'Content-Type': 'multipart/mixed; boundary="+"' },
                body: multiline(
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518824?a=1&b=2 HTTP/1.1',
                    'X-Request-Id:2',
                    'Host:localhost',
                    '',
                    '',
                    '--+',
                    'Content-Type:application/http; msgtype=request',
                    '',
                    'GET /openapi/port/ref/v1/instruments/details/1518825?a=%26%3D HTTP/1.1',
                    'X-Request-Id:3',
                    'Host:localhost',
                    '',
                    '',
                    '--+--',
                    '',
                ),
                cache: false,
                requestId: '1',
            },
        ]);
    });

    it('disposes okay', () => {
        transportBatch = new TransportBatch(transport, validBaseUrl);
        transportBatch.get('foo', 'bar');
        transportBatch.get('foo', 'bar');
        transportBatch.dispose();
        expect(transportBatch.queue).toEqual([]);
        expect(transport.dispose.mock.calls.length).toEqual(1);
        transport.dispose.mockClear();

        tick(1);

        expect(transport.post.mock.calls.length).toEqual(0);
    });
});
