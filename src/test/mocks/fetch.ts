export class FetchResponse {
    status: number;
    response?: string | Blob | Record<string, unknown>;
    headers: Headers = new Headers();
    size = 0;
    url = '';

    constructor(
        status: number,
        response?: string | Blob | Record<string, unknown>,
        contentType?: string,
    ) {
        this.status = status;
        this.response = response;

        const headerValue =
            contentType ||
            (typeof response === 'object'
                ? 'application/json; utf-8'
                : 'application/text');

        this.headers.set('content-type', headerValue);
    }

    text() {
        return Promise.resolve(
            typeof this.response === 'object'
                ? JSON.stringify(this.response)
                : this.response,
        );
    }

    blob() {
        return Promise.resolve(this.response);
    }
}

function mockFetch() {
    const fetch = (jest.fn() as unknown) as jest.MockedFunction<
        typeof window.fetch & {
            resolve: (
                status: number,
                data?: string | Blob | Record<string, unknown>,
                contentType?: string,
            ) => Promise<any>;
            reject: (
                status: number | Error,
                data?: string | Blob | Record<string, unknown>,
                contentType?: string,
            ) => Promise<any>;
        }
    >;
    // @ts-expect-error
    global.fetch = fetch;
    fetch.mockImplementation(function () {
        return new Promise(function (resolve, reject) {
            // assign in here so that a particular resolve/reject can be captured
            // @ts-expect-error
            fetch.resolve = function (
                status: number,
                data: string | Blob | Record<string, unknown>,
                contentType: string,
            ) {
                // @ts-ignore
                resolve(new FetchResponse(status, data, contentType));
            };
            // @ts-expect-error
            fetch.reject = function (
                status: number | Error,
                data?: string | Blob | Record<string, unknown>,
                contentType?: string,
            ) {
                if (status instanceof Error) {
                    reject(status);
                    return;
                }
                reject(new FetchResponse(status, data, contentType));
            };
        });
    });

    fetch.resolve = () => {
        throw new Error('fetch not called');
    };

    fetch.reject = () => {
        throw new Error('fetch not called');
    };
    return fetch;
}

export default mockFetch;
