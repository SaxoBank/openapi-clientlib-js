export type HTTPMethodType =
    | 'get'
    | 'put'
    | 'post'
    | 'delete'
    | 'patch'
    | 'options'
    | 'head';

export interface OAPIRequestResult<Response = any> {
    response: Response;
    status: number;
    headers: Headers;
    size: number;
    url: string;
    responseType?: string;
    isNetworkError?: never;
}

export type NetworkErrorType =
    | 'initial-rejection'
    | 'header-get'
    | 'convert-response'
    | 'convert-response-reject'
    | 'convert-response-reject-no-content-type'
    | 'convert-response-exception'
    | 'no-status'
    | 'proxy-error'
    | 'akamai-error';

export interface NetworkError {
    message?: string | Error;
    isNetworkError: true;
    status?: never;
    type: NetworkErrorType;
    url?: string;
}

export type StringTemplateArgs = Record<
    string,
    string | number | boolean
> | null;

export type QueryParams = Record<
    string,
    | string
    | number
    | boolean
    | null
    | undefined
    | ReadonlyArray<string | number | boolean>
>;

export type HTTPMethod = <Response = any>(
    servicePath: string,
    urlTemplate: string,
    templateArgs?: StringTemplateArgs,
    options?: RequestOptions,
) => Promise<OAPIRequestResult<Response>>;

export interface RequestOptions {
    readonly headers?: Record<string, string>;
    readonly queryParams?: QueryParams | null;
    readonly body?: any;
    readonly cache?: boolean;
    readonly requestId?: string;
    readonly signal?: AbortSignal | null;
}
