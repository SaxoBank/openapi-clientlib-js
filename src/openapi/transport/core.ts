import { formatUrl } from '../../utils/string';
import fetch from '../../utils/fetch';
import { getRequestId } from '../../utils/request';
import { shouldUseCloud } from './options';
import type { TransportOptions, Services, URLDetails } from './types';
import type {
    HTTPMethodType,
    StringTemplateArgs,
    RequestOptions,
} from '../../types';
import TransportBase from './transport-base';

/**
 * Handles core transport to the openapi rest service. This is little more than a thin layer on top of fetch, adding
 * cache breaking, language header adding and a convenient mechanism for making transport calls.
 */
class TransportCore extends TransportBase {
    baseUrl: string;
    language?: string;
    services: Services = {};
    defaultCache = true;
    useXHttpMethodOverride = false;
    fetch = fetch;

    /**
     * @param baseUrl - (optional) The base url used for all open api requests. This should be an absolute URL.
     * @param options - (optional) Transport options
     */
    constructor(baseUrl?: string | null, options?: TransportOptions) {
        super();
        if (!baseUrl) {
            throw new Error('Missing required parameter: baseUrl');
        }
        this.baseUrl = baseUrl;
        this.language = options?.language;
        if (options && typeof options.defaultCache === 'boolean') {
            this.defaultCache = options.defaultCache;
        }

        this.services = options?.services || {};
    }

    dispose() {}

    prepareTransportMethod(method: HTTPMethodType) {
        return (
            servicePath: string,
            urlTemplate: string,
            templateArgs?: StringTemplateArgs,
            options?: RequestOptions,
        ) => {
            let headers: Record<string, string> = {};
            let cache = this.defaultCache;

            if (!servicePath || !urlTemplate) {
                throw new Error(
                    'Transport calls require a service path and a URL',
                );
            }

            if (options) {
                if (options.headers) {
                    headers = options.headers;
                }
                if (typeof options.cache === 'boolean') {
                    cache = options.cache;
                }
            }

            const url = formatUrl(
                urlTemplate,
                templateArgs,
                options?.queryParams,
            );

            if (this.language) {
                if (!headers['Accept-Language']) {
                    headers['Accept-Language'] = this.language + ', *;q=0.5';
                }
            }

            if (!headers['X-Request-Id']) {
                // making toString as headers accept string types in values
                headers['X-Request-Id'] =
                    (options && options.requestId) || getRequestId().toString();
            }

            const urlDetails: URLDetails = {
                method,
                servicePath,
                url,
            };
            const basePath = shouldUseCloud(
                this.services[servicePath],
                urlDetails,
            )
                ? '/oapi'
                : '/openapi';

            return this.fetch(
                method,
                this.baseUrl + basePath + '/' + servicePath + '/' + url,
                {
                    body: options?.body,
                    headers,
                    cache,
                    useXHttpMethodOverride: this.useXHttpMethodOverride,
                    signal: options?.signal,
                },
            );
        };
    }

    /**
     * Sets whether to replace put/patch/delete calls with a post that has
     * a X-HTTP-Method-Override header
     * @param useXHttpMethodOverride - useXHttpMethodOverride
     */
    setUseXHttpMethodOverride(useXHttpMethodOverride: boolean) {
        this.useXHttpMethodOverride = useXHttpMethodOverride;
    }
}

export default TransportCore;
