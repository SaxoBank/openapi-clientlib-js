import { formatUrl } from '../../utils/string';
import fetch from '../../utils/fetch';
import { getRequestId } from '../../utils/request';
import { shouldUseCloud } from './options';
import type { TransportOptions, TransportCoreOptions, Services } from './types';
import type { HTTPMethodType } from '../../utils/fetch';
import TransportBase from './transport-base';
import type { StringTemplateArgs } from '../../utils/string';

/**
 * Handles core transport to the openapi rest service. This is little more than a thin layer on top of fetch, adding
 * cache breaking, language header adding and a convenient mechanism for making transport calls.
 * @class
 * @alias saxo.openapi.TransportCore
 * @param {string} baseUrl - The base url used for all open api requests. This should be an absolute URL.
 * @param {object} [options]
 * @param {string} [options.language] - The language sent as a header if not overridden.
 * @param {boolean} [options.defaultCache=true] - Sets the default caching behaviour if not overridden on a call.
 * @param {Object.<string, saxo.ServiceOptions>} [options.services] - Per-service options, keyed by service path.
 */
class TransportCore extends TransportBase {
    baseUrl: string;
    language?: string;
    services: Services = {};
    defaultCache = true;
    useXHttpMethodOverride = false;
    fetch = fetch;

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
            servicePath?: string,
            urlTemplate?: string,
            templateArgs?: StringTemplateArgs,
            options?: TransportCoreOptions,
        ) => {
            let body;
            let headers: Record<string, string> = {};
            let cache = this.defaultCache;
            let queryParams;

            if (!servicePath || !urlTemplate) {
                throw new Error(
                    'Transport calls require a service path and a URL',
                );
            }

            if (options) {
                if (options.headers) {
                    headers = options.headers;
                }
                body = options.body;
                if (typeof options.cache === 'boolean') {
                    cache = options.cache;
                }

                queryParams = options.queryParams;
            }

            const url = formatUrl(urlTemplate, templateArgs, queryParams);

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

            const basePath = shouldUseCloud(this.services[servicePath])
                ? '/oapi'
                : '/openapi';

            return this.fetch(
                method,
                this.baseUrl + basePath + '/' + servicePath + '/' + url,
                {
                    body,
                    headers,
                    cache,
                    useXHttpMethodOverride: this.useXHttpMethodOverride,
                },
            );
        };
    }

    /**
     * Sets whether to replace put/patch/delete calls with a post that has
     * a X-HTTP-Method-Override header
     * @param {boolean} useXHttpMethodOverride
     */
    setUseXHttpMethodOverride(useXHttpMethodOverride: boolean) {
        this.useXHttpMethodOverride = useXHttpMethodOverride;
    }
}

export default TransportCore;
