export type HTTPMethods = 'get' | 'put' | 'post' | 'delete' | 'patch' | 'options' | 'head';

export type APIStatusCode = 401 | 404 | 200 | 201 | 500;

export type UseCloud = {
    useCloud?: boolean | string | (() => boolean | string);
};

export type Services = {
    [k in string]: UseCloud;
};
export interface Options {
    authErrorsDebouncePeriod?: number;
    language?: string;
    services?: Services;
    host?: 'string';
    timeoutMs?: number;
    defaultCache?: boolean;
}

export interface APIResponse {
    response: string;
    headers?: {
        get: (key: string) => string;
    };
    isNetworkError?: boolean;
    status?: number;
}

export interface TransportCoreOptions {
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number>;
    body?: string | Record<string, string | number | boolean> | URLSearchParams | File | FormData;
    cache?: boolean;
    requestId?: string;
}

// eslint-disable-next-line max-len
export type MethodInputArgs = [string | undefined, string | undefined, Record<string, string | number> | null | undefined, TransportCoreOptions | undefined];
