export class FetchResponse {
    status: number;
    response: unknown;
    headers: {
        get(name: string): string;
    };

    constructor(status: number, response: unknown, contentType: string) {
        this.status = status;
        this.response = response;

        const headersMap: Record<string, string> = {
            'content-type':
                contentType ||
                (typeof response === 'object'
                    ? 'application/json; utf-8'
                    : 'application/text'),
        };

        this.headers = {
            get(headerName: string) {
                headerName = headerName.toLowerCase();
                return headersMap[headerName];
            },
        };
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
    const fetch: jest.Mock = jest.fn();
    // @ts-expect-error
    global.fetch = fetch;
    fetch.mockImplementation(function () {
        return new Promise(function (resolve, reject) {
            // assign in here so that a particular resolve/reject can be captured
            // @ts-expect-error
            fetch.resolve = function (
                status: number,
                data: unknown,
                contentType: string,
            ) {
                resolve(new FetchResponse(status, data, contentType));
            };
            // @ts-expect-error
            fetch.reject = function (
                status: number | Error,
                data: unknown,
                contentType: string,
            ) {
                if (status instanceof Error) {
                    reject(status);
                    return;
                }
                reject(new FetchResponse(status, data, contentType));
            };
        });
    });
    // @ts-expect-error
    fetch.resolve = () => {
        throw new Error('fetch not called');
    };
    // @ts-expect-error
    fetch.reject = () => {
        throw new Error('fetch not called');
    };
    return fetch as jest.Mock & {
        resolve: (_?: any) => never;
        reject: (_?: any) => never;
    };
}

export default mockFetch;
