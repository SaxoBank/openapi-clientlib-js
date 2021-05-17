import type AuthProvider from '../authProvider';
import type { HTTPMethodInputArgs, HTTPStatusCode } from './types';
import type {
    OAPIRequestResult,
    HTTPMethodType,
    StringTemplateArgs,
    RequestOptions,
} from '../../types';
import type { ITransport } from './transport-base';
import TransportBase from './transport-base';

export type QueueItem = {
    method: HTTPMethodType;
    args: HTTPMethodInputArgs;
    servicePath: string;
    urlTemplate: string;
    urlArgs?: StringTemplateArgs;
    options?: RequestOptions;
    resolve: (...value: any[]) => void;
    reject: (reason?: any, ...rest: any[]) => void;
};

/**
 * TransportQueue wraps a transport class to allow the queueing of transport calls, so that all calls can be paused until after a particular event.
 * 1. This coordinates with authentication so that calls are queued whilst not authenticated
 * 2. The ability to wait for a promise to complete see {@link  TransportQueue#waitFor}.
 *    The old library had an option initLoadBalancerCookies which did
 *    two calls to isalive before allowing any other calls through. This can be implemented with this class.
 * 3. It serves as a base class for auto batching, which by its nature queues calls.
 * @param transport -
 *      The transport to wrap.
 * @param authProvider - (optional) If provided then calls will be queued whilst the token is expired.
 *      If not given then calls will continue even when the authentication is not expired and no 401 calls will be handled.
 */
class TransportQueue extends TransportBase {
    isQueueing = false;
    authProvider: AuthProvider | null = null;
    queue: QueueItem[] = [];
    transport: ITransport;
    waitForPromises: Promise<any>[] = [];

    constructor(transport: ITransport, authProvider?: AuthProvider) {
        super();
        if (!transport) {
            throw new Error(
                'Missing required parameter: transport in TransportQueue',
            );
        }

        if (authProvider) {
            this.authProvider = authProvider;
            if (authProvider.getExpiry() < Date.now()) {
                this.isQueueing = true;
            }
            // subscribe to listen for authentication changes that might trigger auth to be valid and the queue to empty
            authProvider.on(
                authProvider.EVENT_TOKEN_RECEIVED,
                this.authTokenReceived,
                this,
            );
        }

        this.transport = transport;
    }

    private tryEmptyQueue() {
        if (
            this.waitForPromises.length === 0 &&
            (!this.authProvider || this.authProvider.getExpiry() > Date.now())
        ) {
            this.isQueueing = false;
            this.emptyQueue();
        }
    }

    prepareTransportMethod(method: HTTPMethodType) {
        return (...args: HTTPMethodInputArgs) => {
            if (!this.isQueueing) {
                // checking expiry every time so that if device goes to sleep and is woken then
                // we intercept a call about to be made and then do not have to cope with the 401 responses
                if (
                    this.authProvider &&
                    this.authProvider.getExpiry() < Date.now()
                ) {
                    this.isQueueing = true;
                    this.authProvider.refreshOpenApiToken();
                }
            }

            const transportCallArguments = args;

            return new Promise<OAPIRequestResult>((resolve, reject) => {
                const queueItem = {
                    method,
                    args: transportCallArguments,
                    servicePath: transportCallArguments[0] || '',
                    urlTemplate: transportCallArguments[1] || '',
                    urlArgs: transportCallArguments[2],
                    options: transportCallArguments[3],
                    resolve,
                    reject,
                };

                if (this.isQueueing && this.shouldQueue(queueItem)) {
                    this.addToQueue(queueItem);
                } else {
                    this.runQueueItem(queueItem);
                }
            });
        };
    }

    private onWaitForPromiseResolved(promise: Promise<any>) {
        this.waitForPromises.splice(this.waitForPromises.indexOf(promise), 1);

        this.tryEmptyQueue();
    }

    private authTokenReceived = () => {
        this.tryEmptyQueue();
    };

    waitFor(promise: Promise<any>) {
        this.waitForPromises.push(promise);
        this.isQueueing = true;
        promise.then(() => this.onWaitForPromiseResolved(promise));
    }

    protected emptyQueue() {
        for (let i = 0; i < this.queue.length; i++) {
            this.runQueueItem(this.queue[i]);
        }
        this.queue.length = 0;
    }

    protected runQueueItem(item: QueueItem) {
        this.transport[item.method](...item.args).then(
            (...args: any[]) => {
                item.resolve(...args);
            },
            // @ts-expect-error as it should return promise but returning direct void
            (result: { status: HTTPStatusCode }, ...args: [any]) => {
                if (this.authProvider && result && result.status === 401) {
                    this.addToQueue(item);
                    // if we are fetching a new token, wait
                    if (this.authProvider.isFetchingNewToken()) {
                        this.isQueueing = true;
                    } else {
                        // if not we might already have a new token, so run straight away
                        this.tryEmptyQueue();
                    }
                    return;
                }
                item.reject(result, ...args);
            },
        );
    }

    protected addToQueue(item: QueueItem) {
        this.queue.push(item);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected shouldQueue(_item: QueueItem) {
        return true;
    }

    //  * Disposes the transport queue and removes any pending items.
    dispose() {
        this.queue.length = 0;
        if (this.authProvider) {
            this.authProvider.off(
                this.authProvider.EVENT_TOKEN_RECEIVED,
                this.authTokenReceived,
                this,
            );
        }
        this.transport.dispose();
    }
}

export default TransportQueue;
