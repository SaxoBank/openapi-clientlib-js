import { FetchResponse } from '../test/mocks/fetch';
import { installClock, uninstallClock, tick } from '../test/utils';
import { convertFetchSuccess, convertFetchReject } from './fetch';

describe('utils fetch', () => {
    it('images are downloaded as a binary blob', async () => {
        const contentType = 'image/jpeg';
        const result = new FetchResponse(
            200,
            'this is a binary image',
            contentType,
        ) as unknown as Response;
        const promise = convertFetchSuccess('url', 'body', 0, result);

        const response = await promise;
        expect(response.response).toEqual('this is a binary image');
        expect(response.status).toEqual(200);
        expect(response.headers.get('content-type')).toEqual(contentType);
        expect(response.responseType).toEqual('blob');
    });

    it('octet-stream are downloaded as a binary blob', async () => {
        const contentType = 'application/octet-stream';
        const result = new FetchResponse(
            200,
            'this is generic binary data',
            contentType,
        ) as unknown as Response;
        const promise = convertFetchSuccess('url', 'body', 0, result);

        const response = await promise;
        expect(response.response).toEqual('this is generic binary data');
        expect(response.status).toEqual(200);
        expect(response.headers.get('content-type')).toEqual(contentType);
        expect(response.responseType).toEqual('blob');
    });

    it('json is downloaded and converted to an object', async () => {
        const contentType = 'application/json';
        const result = new FetchResponse(
            200,
            '{"test":1}',
            contentType,
        ) as unknown as Response;
        const promise = convertFetchSuccess('url', 'body', 0, result);

        const response = await promise;
        expect(response.response).toEqual({ test: 1 });
        expect(response.status).toEqual(200);
        expect(response.headers.get('content-type')).toEqual(contentType);
        expect(response.responseType).toEqual('json');
    });

    it('xslx is downloaded as a binary blob', async () => {
        const contentType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const result = new FetchResponse(
            200,
            'this is a binary string',
            contentType,
        ) as unknown as Response;
        const promise = convertFetchSuccess('url', 'body', 0, result);

        const response = await promise;
        expect(response.response).toEqual('this is a binary string');
        expect(response.status).toEqual(200);
        expect(response.headers.get('content-type')).toEqual(contentType);
        expect(response.responseType).toEqual('blob');
    });

    it('unknown file types are downloaded as text', async () => {
        const contentType = 'unknown/file';
        const result = new FetchResponse(
            200,
            'this is a string',
            contentType,
        ) as unknown as Response;
        const promise = convertFetchSuccess('url', 'body', 0, result);

        const response = await promise;
        expect(response.response).toEqual('this is a string');
        expect(response.status).toEqual(200);
        expect(response.headers.get('content-type')).toEqual(contentType);
        expect(response.responseType).toEqual('text');
    });

    describe('failures', () => {
        it('rejects if throwing getting header', async () => {
            // @ts-ignore
            const result = {
                headers: {
                    get() {
                        throw new Error('header exception');
                    },
                },
                status: 200,
                text: () => {
                    return Promise.resolve('');
                },
            };

            const promise = convertFetchSuccess(
                'url',
                'body',
                0,
                // @ts-ignore
                result,
            );

            await expect(promise).rejects.toMatchInlineSnapshot(`
                        Object {
                          "headers": Object {
                            "get": [Function],
                          },
                          "isNetworkError": true,
                          "networkErrorType": "headers-get-failure",
                          "requestId": undefined,
                          "response": "",
                          "responseType": "text",
                          "size": 0,
                          "status": 200,
                          "url": "url",
                        }
                    `);
        });

        it('rejects if throwing getting text', async () => {
            // @ts-ignore
            const result = {
                headers: {
                    get(headerName: string) {
                        if (headerName === 'content-type') {
                            return 'multipart/mixed';
                        }
                        return undefined;
                    },
                },
                status: 200,
                text: () => {
                    throw new Error('Failed to fetch');
                },
            };

            const promise = convertFetchSuccess(
                'url',
                'body',
                0,
                // @ts-ignore
                result,
            );

            await expect(promise).rejects.toMatchInlineSnapshot(`
                        Object {
                          "isNetworkError": true,
                          "message": "Failed to fetch",
                          "networkErrorType": "convert-response-exception",
                          "url": "url",
                        }
                    `);
        });

        it('rejects if rejection getting text', async () => {
            // @ts-ignore
            const result = {
                headers: {
                    get(headerName: string) {
                        if (headerName === 'content-type') {
                            return 'multipart/mixed';
                        }
                        return undefined;
                    },
                },
                status: 200,
                text: () => {
                    return Promise.reject('Failed to fetch');
                },
            };

            const promise = convertFetchSuccess(
                'url',
                'body',
                0,
                // @ts-ignore
                result,
            );

            await expect(promise).rejects.toMatchInlineSnapshot(`
                        Object {
                          "isNetworkError": true,
                          "message": "Failed to fetch",
                          "networkErrorType": "convert-response-reject",
                          "url": "url",
                        }
                    `);
        });
    });

    describe('clearing timers', () => {
        beforeEach(() => {
            installClock();
        });

        afterEach(() => {
            uninstallClock();
        });

        it('convertFetchSuccess clears timers', () => {
            const timerSpy = jest.fn().mockName('timerSpy');
            const timerId = window.setTimeout(timerSpy);
            const result = new FetchResponse(
                200,
                'this is a string',
                'application/text',
            ) as unknown as Response;
            convertFetchSuccess('url', 'body', timerId, result);
            tick(1);

            expect(timerSpy).not.toBeCalled();
        });

        it('convertFetchReject clears timers', () => {
            const timerSpy = jest.fn().mockName('timerSpy');
            const timerId = window.setTimeout(timerSpy);
            const promise = convertFetchReject(
                'url',
                'body',
                timerId,
                new Error(),
            ).catch(() => {});
            tick(1);

            expect(timerSpy).not.toBeCalled();

            return promise;
        });
    });
});
