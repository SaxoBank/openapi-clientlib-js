import type { HTTPMethods, TransportCoreOptions } from './types';
import type { StringTemplateArgs } from '../../utils/string';

export type HTTPMethodResult = {
    response?: string | Blob | Record<string, unknown>;
    status: number;
    headers: Headers;
    size: number;
    url: string;
    responseType?: string;
    isNetworkError?: boolean;
};

type MethodReturn = (
    servicePath?: string,
    urlTemplate?: string,
    templateArgs?: StringTemplateArgs,
    options?: TransportCoreOptions,
) => Promise<HTTPMethodResult>;

export interface ITransport {
    prepareTransportMethod: (arg0: HTTPMethods) => MethodReturn;
    dispose: () => void;
    get: MethodReturn;
    post: MethodReturn;
    put: MethodReturn;
    delete: MethodReturn;
    patch: MethodReturn;
    head: MethodReturn;
    options: MethodReturn;
}

abstract class TransportBase implements ITransport {
    abstract dispose(): void;

    abstract prepareTransportMethod(
        method: HTTPMethods,
    ): (
        servicePath?: string,
        urlTemplate?: string,
        templateArgs?: StringTemplateArgs,
        options?: TransportCoreOptions,
    ) => Promise<HTTPMethodResult>;

    get = this.prepareTransportMethod('get');
    post = this.prepareTransportMethod('post');
    put = this.prepareTransportMethod('put');
    delete = this.prepareTransportMethod('delete');
    patch = this.prepareTransportMethod('patch');
    head = this.prepareTransportMethod('head');
    options = this.prepareTransportMethod('options');
}

export default TransportBase;
