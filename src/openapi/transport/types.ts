import type { RequestOptions, StringTemplateArgs } from '../../types';

export type URLDetails = {
    method: string;
    servicePath: string;
    url: string;
};

export type UseCloud = {
    useCloud?:
        | boolean
        | string
        | ((urlDetails?: URLDetails) => boolean | string);
};

export type Services = {
    [k in string]: UseCloud;
};

export interface TransportOptions {
    /**
     * The period within which errors on different tokens cause an endpoint auth errors to be ignored.
     */
    readonly authErrorsDebouncePeriod?: number;
    /**
     * The language sent as a header if not overridden.
     */
    readonly language?: string;
    /**
     * Per-service options, keyed by service path.
     */
    readonly services?: Services;
    readonly host?: 'string';
    readonly timeoutMs?: number;
    /**
     * Sets the default caching behaviour if not overridden on a call.
     */
    readonly defaultCache?: boolean;
}

// eslint-disable-next-line max-len
export type HTTPMethodInputArgs = [
    string,
    string,
    StringTemplateArgs | undefined,
    RequestOptions | undefined,
];
