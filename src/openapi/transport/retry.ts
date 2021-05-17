import type { HTTPMethodInputArgs } from './types';
import type {
    OAPICallResult,
    HTTPMethodType,
    NetworkError,
} from '../../utils/fetch';
import type TransportCore from './core';
import TransportBase from './transport-base';

interface TransportCall {
    method: HTTPMethodType;
    args: HTTPMethodInputArgs;
    resolve: (value?: any) => void;
    reject: (value?: any) => void;
    retryCount: number;
    retryTimer: ReturnType<typeof setTimeout> | null;
}

interface RetryOptions {
    retryTimeouts?: number[];
    statuses?: number[];
    retryNetworkError?: boolean;
    retryLimit?: number;
}

type HTTPRequestRetryOptions = Partial<Record<HTTPMethodType, RetryOptions>>;

interface Options {
    /**
     * The number of ms after that the retry calls should be done.
     */
    retryTimeout: number;
    /**
     * Http methods that should retry. For each method provide an object with `retryLimit` parameter.
     * Note that the default is to not retry. a call will be retried if it is a network error and retryNetworkError is true or the rejection
     * includes a status and it is in the statuses list.
     */
    methods?: HTTPRequestRetryOptions;
}

/**
 * TransportRetry wraps a transport class to allow the retrying of failed transport calls, so the calls are resent after a timeout.
 *
 * @example
 * ```ts
 * // Constructor with parameters
 * * const transportRetry = new TransportRetry(transport, {
 *      retryTimeout:10000,
 *      methods:{
 *          'delete':{ retryLimit:3, retryNetworkError: true },
 *          'post':{ retryTimeouts: [1000, 1000, 2000, 3000, 5000], statuses: [504], retryNetworkError: false },
 *      }
 * });
 * ```
 */
class TransportRetry extends TransportBase {
    retryTimeout = 0;
    methods: HTTPRequestRetryOptions;
    transport: TransportCore;
    failedCalls: TransportCall[] = [];
    individualFailedCalls: TransportCall[] = [];
    retryTimer: ReturnType<typeof setTimeout> | null = null;
    isDisposed = false;

    /**
     * @param transport - The transport to wrap.
     * @param options - (optional) Settings options. Define retry timeout, http methods to retry and max retry limit
     * per http method type. If not given then calls will run with underlying transport without retry logic.
     */
    constructor(transport: TransportCore, options?: Options) {
        super();
        if (!transport) {
            throw new Error(
                'Missing required parameter: transport in TransportRetry',
            );
        }
        if (options?.retryTimeout && options.retryTimeout > 0) {
            this.retryTimeout = options.retryTimeout;
        }
        this.methods = options?.methods ? options.methods : {};

        this.transport = transport;
    }

    prepareTransportMethod(method: HTTPMethodType) {
        return (...args: HTTPMethodInputArgs) => {
            const methodRetryOptions = this.methods[method];

            // checking if http method call should be handled by RetryTransport
            if (
                methodRetryOptions &&
                ((methodRetryOptions.retryLimit &&
                    methodRetryOptions.retryLimit > 0) ||
                    methodRetryOptions.retryTimeouts)
            ) {
                return new Promise<OAPICallResult>((resolve, reject) => {
                    const transportCall = {
                        method,
                        args,
                        resolve,
                        reject,
                        retryCount: 0,
                        retryTimer: null,
                    };

                    this.sendTransportCall(transportCall);
                });
            }
            // calls underlying transport http method
            return this.transport[method](...args);
        };
    }

    protected sendTransportCall = (transportCall: TransportCall) => {
        this.transport[transportCall.method](...transportCall.args).then(
            transportCall.resolve,
            (response: OAPICallResult | NetworkError) => {
                const callOptions = this.methods[
                    transportCall.method
                ] as RetryOptions;
                const isRetryForStatus =
                    response?.status &&
                    callOptions?.statuses?.includes(response.status);

                const isRetryRequest = response?.isNetworkError
                    ? callOptions.retryNetworkError
                    : isRetryForStatus;

                const isWithinRetryLimitOption =
                    callOptions.retryLimit &&
                    callOptions.retryLimit > 0 &&
                    transportCall.retryCount < callOptions.retryLimit;

                const isWithinRetryTimeoutsOption =
                    callOptions.retryTimeouts &&
                    transportCall.retryCount < callOptions.retryTimeouts.length;

                if (
                    isRetryRequest &&
                    (isWithinRetryLimitOption || isWithinRetryTimeoutsOption) &&
                    !this.isDisposed
                ) {
                    this.addFailedCall(transportCall);
                } else {
                    transportCall.reject(response);
                }
            },
        );
    };

    protected addFailedCall(transportCall: TransportCall) {
        const callOptions = this.methods[transportCall.method] as RetryOptions;
        if (
            callOptions.retryTimeouts &&
            callOptions.retryTimeouts.length > transportCall.retryCount
        ) {
            // schedule an individual retry timeout
            this.individualFailedCalls.push(transportCall);
            transportCall.retryTimer = setTimeout(() => {
                this.retryIndividualFailedCall(transportCall);
            }, callOptions.retryTimeouts[transportCall.retryCount]);
        } else {
            this.failedCalls.push(transportCall);
            if (!this.retryTimer) {
                // schedule a retry timeout for all failed calls
                this.retryTimer = setTimeout(() => {
                    this.retryFailedCalls();
                }, this.retryTimeout);
            }
        }
        transportCall.retryCount++;
    }

    protected retryFailedCalls() {
        this.retryTimer = null;
        while (this.failedCalls.length > 0) {
            this.sendTransportCall(this.failedCalls.shift() as TransportCall);
        }
    }

    protected retryIndividualFailedCall(transportCall: TransportCall) {
        transportCall.retryTimer = null;
        const individualFailedCallsIndex = this.individualFailedCalls.indexOf(
            transportCall,
        );
        if (individualFailedCallsIndex >= 0) {
            this.individualFailedCalls.splice(individualFailedCallsIndex, 1);
        }
        this.sendTransportCall(transportCall);
    }

    dispose() {
        this.isDisposed = true;
        this.individualFailedCalls.forEach((failedCall) => {
            if (failedCall.retryTimer != null) {
                clearTimeout(failedCall.retryTimer);
                failedCall.retryTimer = null;
            }
        });
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.individualFailedCalls
            .concat(this.failedCalls)
            .forEach((transportCall) => {
                transportCall.reject();
            });
        this.individualFailedCalls.length = 0;
        this.failedCalls.length = 0;
        this.transport.dispose();
    }
}

export default TransportRetry;
