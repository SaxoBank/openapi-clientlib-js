export function FetchResponse(status, response, contentType) {
    this.status = status;
    this.response = response;

    const headersMap = {
        'content-type':
            contentType ||
            (typeof response === 'object'
                ? 'application/json; utf-8'
                : 'application/text'),
    };

    this.headers = {
        get(headerName) {
            headerName = headerName.toLowerCase();
            return headersMap[headerName];
        },
    };

    this.text = function() {
        return new Promise(function(resolve) {
            if (typeof response === 'object') {
                resolve(JSON.stringify(response));
            } else {
                resolve(response);
            }
        });
    };

    this.blob = function() {
        return new Promise(function(resolve) {
            resolve(response);
        });
    };
}

function mockFetch() {
    const fetch = jest.fn();
    global.fetch = fetch;
    fetch.mockImplementation(function() {
        return new Promise(function(resolve, reject) {
            // assign in here so that a particular resolve/reject can be captured
            fetch.resolve = function(status, data, contentType) {
                resolve(new FetchResponse(status, data, contentType));
            };
            fetch.reject = function(status, data, contentType) {
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
