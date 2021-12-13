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

    it('doc is downloaded as a binary blob', async () => {
        const contentType = 'application/msword';
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

    it('docx is downloaded as a binary blob', async () => {
        const contentType =
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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

    it('multipart-mixed file types are downloaded as text', async () => {
        const contentType = 'multipart/mixed';
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

        it('rejects if invalid json', async () => {
            // @ts-ignore
            const result = {
                headers: {
                    get(headerName: string) {
                        if (headerName === 'content-type') {
                            return 'application/json';
                        }
                        return undefined;
                    },
                },
                status: 200,
                text: () => {
                    return Promise.resolve('{"partial":true');
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
                          "networkErrorType": "json-parse-failed",
                          "response": "{\\"partial\\":true",
                          "size": 15,
                          "status": 200,
                          "url": "url",
                        }
                    `);
        });
    });

    it('rejects if no content type and text throws', async () => {
        // @ts-ignore
        const result = {
            headers: {
                get(headerName: string) {
                    if (headerName === 'content-type') {
                        return 'unknown';
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

    // we would like to remove this test case in the future
    it('resolves if no content type and text rejects', async () => {
        // @ts-ignore
        const result = {
            headers: {
                get(headerName: string) {
                    if (headerName === 'content-type') {
                        return 'unknown';
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

        await expect(promise).resolves.toMatchInlineSnapshot(`
                    Object {
                      "headers": Object {
                        "get": [Function],
                      },
                      "response": undefined,
                      "size": 0,
                      "status": 200,
                      "url": "url",
                    }
                `);
    });

    it('rejects if no status', async () => {
        // @ts-ignore
        const result = {
            headers: {
                get(headerName: string) {
                    if (headerName === 'content-type') {
                        return 'application/json';
                    }
                    return undefined;
                },
            },
            status: undefined,
            text: () => {
                return Promise.resolve('{}');
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
                      "networkErrorType": "no-status",
                      "requestId": undefined,
                      "response": Object {},
                      "responseType": "json",
                      "size": 2,
                      "status": undefined,
                      "url": "url",
                    }
                `);
    });

    it('rejects with proxy error', async () => {
        // @ts-ignore
        const result = {
            headers: {
                get(headerName: string) {
                    if (headerName === 'content-type') {
                        return 'application/json';
                    }
                    return undefined;
                },
            },
            status: 407,
            text: () => {
                return Promise.resolve('{}');
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
                      "networkErrorType": "proxy-error",
                      "requestId": undefined,
                      "response": Object {},
                      "responseType": "json",
                      "size": 2,
                      "status": 407,
                      "url": "url",
                    }
                `);
    });

    it('rejects with akamai error', async () => {
        // @ts-ignore
        const result = {
            headers: {
                get(headerName: string) {
                    if (headerName === 'content-type') {
                        return 'html';
                    }
                    return undefined;
                },
            },
            status: 503,
            text: () => {
                return Promise.resolve(
                    '<html>Akamai Error Reference&#32;83486234237498239423949238</html>',
                );
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
                      "networkErrorType": "akamai-error",
                      "requestId": undefined,
                      "response": "<html>Akamai Error Reference&#32;83486234237498239423949238</html>",
                      "responseType": "text",
                      "size": 66,
                      "status": 503,
                      "url": "url",
                    }
                `);
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
