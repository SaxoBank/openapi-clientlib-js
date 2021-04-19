import { multiline } from '../test/utils';
import * as RequestUtils from '../utils/request';
import * as batchUtil from './batch-util';

describe('openapi batchUtil', () => {
    it('parses an empty response', () => {
        expect(batchUtil.parse('--X--')).toEqual([]);
    });

    it('parses a single response', () => {
        expect(
            batchUtil.parse(
                multiline(
                    '--90f26034-d914-44a0-bd16-908fc535018d',
                    'Content-Type: application/http; msgtype=response',
                    '',
                    'HTTP/1.1 201 Created',
                    'Location: ',
                    'X-Request-Id: 1',
                    'Access-Control-Allow-Origin: http://computor.sys.dom',
                    'Access-Control-Allow-Credentials: true',
                    'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                    'Content-Type: application/json; charset=utf-8',
                    '',
                    '{ "mydata": {"Prop": 1}}',
                    '--90f26034-d914-44a0-bd16-908fc535018d--',
                    '',
                ),
            ),
        ).toEqual([{ status: 201, response: { mydata: { Prop: 1 } } }]);
    });

    it('parses array data', () => {
        expect(
            batchUtil.parse(
                multiline(
                    '--90f26034-d914-44a0-bd16-908fc535018d',
                    'Content-Type: application/http; msgtype=response',
                    '',
                    'HTTP/1.1 201 Created',
                    'Location: ',
                    'X-Request-Id: 1',
                    'Access-Control-Allow-Origin: http://computor.sys.dom',
                    'Access-Control-Allow-Credentials: true',
                    'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                    'Content-Type: application/json; charset=utf-8',
                    '',
                    '["mydata", "Prop"]',
                    '--90f26034-d914-44a0-bd16-908fc535018d--',
                    '',
                ),
            ),
        ).toEqual([{ status: 201, response: ['mydata', 'Prop'] }]);
    });

    it('parses multiple responses', () => {
        expect(
            batchUtil.parse(
                multiline(
                    '--90f26034-d914-44a0-bd16-908fc535018d',
                    'Content-Type: application/http; msgtype=response',
                    '',
                    'HTTP/1.1 201 Created',
                    'Location: ',
                    'X-Request-Id: 1',
                    'Access-Control-Allow-Origin: http://computor.sys.dom',
                    'Access-Control-Allow-Credentials: true',
                    'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                    'Content-Type: application/json; charset=utf-8',
                    '',
                    '{ "mydata": {"Prop": 1}}',
                    '--90f26034-d914-44a0-bd16-908fc535018d',
                    'Content-Type: application/http; msgtype=response',
                    '',
                    'HTTP/1.1 200 Ok',
                    'Location: ',
                    'X-Request-Id: 2',
                    'Access-Control-Allow-Origin: http://computor.sys.dom',
                    'Access-Control-Allow-Credentials: true',
                    'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                    'Content-Type: application/json; charset=utf-8',
                    '',
                    '{ "second": 2 }',
                    '--90f26034-d914-44a0-bd16-908fc535018d--',
                    '',
                ),
            ),
        ).toEqual([
            { status: 201, response: { mydata: { Prop: 1 } } },
            { status: 200, response: { second: 2 } },
        ]);
    });

    it('parses multiple responses with explicit parent request id', () => {
        const content = batchUtil.parse(
            multiline(
                '--90f26034-d914-44a0-bd16-908fc535018d',
                'Content-Type: application/http; msgtype=response',
                '',
                'HTTP/1.1 201 Created',
                'Location: ',
                'X-Request-Id: 101',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type: application/json; charset=utf-8',
                '',
                '{ "mydata": {"Prop": 1}}',
                '--90f26034-d914-44a0-bd16-908fc535018d',
                'Content-Type: application/http; msgtype=response',
                '',
                'HTTP/1.1 200 Ok',
                'Location: ',
                'X-Request-Id: 102',
                'Access-Control-Allow-Origin: http://computor.sys.dom',
                'Access-Control-Allow-Credentials: true',
                'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
                'Content-Type: application/json; charset=utf-8',
                '',
                '{ "second": 2 }',
                '--90f26034-d914-44a0-bd16-908fc535018d--',
                '',
            ),
            100,
        );

        expect(content).toEqual([
            { status: 201, response: { mydata: { Prop: 1 } } },
            { status: 200, response: { second: 2 } },
        ]);
    });
});

describe('batch building', () => {
    beforeEach(() => {
        RequestUtils.resetCounter();
    });

    it('handles no requests', () => {
        expect(batchUtil.build([], 'iitbank.com')).toEqual({
            body: multiline('--+--', ''),
            boundary: '+',
        });
    });

    it('handles one request', () => {
        expect(
            batchUtil.build(
                [{ method: 'GET', url: 'openapi/sub' }],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'GET openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'Host:iitbank.com',
                '',
                '', // extra new line is important
                '--+--',
                '',
            ),
            boundary: '+',
        });
    });

    it('increases the boundary when it matches data', () => {
        expect(
            batchUtil.build(
                [{ method: 'POST', url: 'openapi/sub', data: '--+' }],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--++',
                'Content-Type:application/http; msgtype=request',
                '',
                'POST openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                '--+',
                '--++--',
                '',
            ),
            boundary: '++',
        });
    });

    it('increases the boundary when it matches data and the next character matches', () => {
        expect(
            batchUtil.build(
                [{ method: 'POST', url: 'openapi/sub', data: '--++' }],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+-',
                'Content-Type:application/http; msgtype=request',
                '',
                'POST openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                '--++',
                '--+---',
                '',
            ),
            boundary: '+-',
        });
    });

    it('puts headers into the batch', () => {
        expect(
            batchUtil.build(
                [
                    {
                        method: 'GET',
                        url: 'openapi/sub',
                        headers: { 'X-Auth-Request': 'Me' },
                    },
                ],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'GET openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'X-Auth-Request:Me',
                'Host:iitbank.com',
                '',
                '',
                '--+--',
                '',
            ),
            boundary: '+',
        });
    });

    it('adds content-type for POST/PUT', () => {
        expect(
            batchUtil.build(
                [{ method: 'POST', data: 'data', url: 'openapi/sub' }],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'POST openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                'data',
                '--+--',
                '',
            ),
            boundary: '+',
        });

        expect(
            batchUtil.build(
                [{ method: 'PUT', data: 'data', url: 'openapi/sub' }],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'PUT openapi/sub HTTP/1.1',
                'X-Request-Id:2',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                'data',
                '--+--',
                '',
            ),
            boundary: '+',
        });
    });

    it('handles multiple requests', () => {
        expect(
            batchUtil.build(
                [
                    { method: 'POST', data: 'postdata', url: 'openapi/sub' },
                    { method: 'PUT', data: 'putdata', url: 'openapi/bus' },
                    { method: 'GET', url: 'openapi/usb' },
                ],
                'iitbank.com',
            ),
        ).toEqual({
            body: multiline(
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'POST openapi/sub HTTP/1.1',
                'X-Request-Id:1',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                'postdata',
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'PUT openapi/bus HTTP/1.1',
                'X-Request-Id:2',
                'Content-Type:application/json; charset=utf-8',
                'Host:iitbank.com',
                '',
                'putdata',
                '--+',
                'Content-Type:application/http; msgtype=request',
                '',
                'GET openapi/usb HTTP/1.1',
                'X-Request-Id:3',
                'Host:iitbank.com',
                '',
                '',
                '--+--',
                '',
            ),
            boundary: '+',
        });
    });
});
