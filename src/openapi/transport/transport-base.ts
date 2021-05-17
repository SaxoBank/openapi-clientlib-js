import type { HTTPMethodType, HTTPMethod } from '../../types';

export interface ITransport {
    dispose: () => void;
    get: HTTPMethod;
    post: HTTPMethod;
    put: HTTPMethod;
    delete: HTTPMethod;
    patch: HTTPMethod;
    head: HTTPMethod;
    options: HTTPMethod;
}

abstract class TransportBase implements ITransport {
    abstract dispose(): void;

    protected abstract prepareTransportMethod(
        method: HTTPMethodType,
    ): HTTPMethod;

    /**
     * Does a get request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     *  options.headers - (optional) A object map of headers, header key to header value
     *  options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     *  options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * const promise = transport.get("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    get = this.prepareTransportMethod('get');

    /**
     * Does a post request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.body - (optional) The body to send in the request. If it is an object it will be json.stringified.
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * var promise = transport.post("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         body: { "thing": "to-post" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    post = this.prepareTransportMethod('post');

    /**
     * Does a put request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.body - (optional) The body to send in the request. If it is an object it will be json.stringified.
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * const promise = transport.put("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         body: { "thing": "to-put" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    put = this.prepareTransportMethod('put');

    /**
     * Does a delete request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * const promise = transport.delete("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    delete = this.prepareTransportMethod('delete');

    /**
     * Does a patch request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.body - (optional) The body to send in the request. If it is an object it will be json.stringified.
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * var promise = transport.patch("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         body: { "thing": "to-patch" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    patch = this.prepareTransportMethod('patch');

    /**
     * Does a head request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.body - (optional) The body to send in the request. If it is an object it will be json.stringified.
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * const promise = transport.head("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    head = this.prepareTransportMethod('head');

    /**
     * Does an options request against open api.
     *
     * @param servicePath - The service path to make the call on
     * @param urlTemplate - The url path template which follows on from the service path to describe the path for the request.
     * @param templateArgs - An object containing fields matched to the template or null if there are no templateArgs.
     * @param options - (optional) request options
     * ```
     * options.headers - (optional) A object map of headers, header key to header value
     * options.body - (optional) The body to send in the request. If it is an object it will be json.stringified.
     * options.cache - (optional) Override the default cache setting for this call.
     *                         If cache is false then a cache control "nocache" header will be added.
     *                         If cache is false and the method is get then a cache breaker will be added to the url.
     * options.queryParams - (optional) An object map of query params which will be added to
     *                        the URL.
     * ```
     * @returns A promise which will be resolved when a 2xx response is received, otherwise it will be failed.
     *                       The result in the case of success will be an object with a status (number) and a response property
     *                       which will be an object if the call returned with json, otherwise it will be text.
     *                       In the case of failure, there may be no result or there may be a result with a status or
     *                       there may be a result with status and a response, depending on what went wrong.
     * @example
     * ```ts
     * // The call
     * const promise = transport.options("root", "path/to/{accountKey}", { accountKey: "123" }, {
     *                         headers: { "my-header": "header-value" },
     *                         cache: false,
     *                        queryParams: {a: b}});
     *
     *
     * // makes a call to path/to/123?a=b
     * // success
     * promise.then(function(result) {
     *         console.log("The status is " + Number(result.status));
     *         console.log("My result is ...");
     *        console.dir(result.response);
     * });
     *
     * // failure
     * promise.catch(function(result) {
     *         if (result) {
     *             if (result.status) {
     *                 console.log("a call was made but returned status " + Number(result.status));
     *                 if (result.response) {
     *                     console.log("Open API's response was...");
     *                     console.dir(result.response);
     *                 }
     *             } else {
     *                 console.log("result could be an exception");
     *             }
     *         } else {
     *             console.log("an unknown error occurred");
     *         }
     * });
     * ```
     */
    options = this.prepareTransportMethod('options');
}

export default TransportBase;
