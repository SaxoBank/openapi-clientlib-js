import type { HTTPMethods, TransportCoreOptions } from './types';

type MethodReturn = (
    servicePath?: string,
    urlTemplate?: string,
    templateArgs?: Record<string, string | number> | null,
    options?: TransportCoreOptions,
) => Promise<
    | {
          response?: string | Blob;
          status: number;
          headers: {
              get: (key: string) => string;
          };
          size: number;
          url: string;
          responseType?: string;
          isNetworkError?: boolean;
      }
    | void
    | unknown
>;

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
        templateArgs?: Record<string, string | number> | null,
        options?: TransportCoreOptions,
    ) => Promise<
        | {
              response?: string | Blob;
              status: number;
              headers: {
                  get: (key: string) => string;
              };
              size: number;
              url: string;
              responseType?: string;
              isNetworkError?: boolean;
          }
        | void
        | unknown
    >;

    get = this.prepareTransportMethod('get');
    post = this.prepareTransportMethod('post');
    put = this.prepareTransportMethod('put');
    delete = this.prepareTransportMethod('delete');
    patch = this.prepareTransportMethod('patch');
    head = this.prepareTransportMethod('head');
    options = this.prepareTransportMethod('options');
}

export default TransportBase;
