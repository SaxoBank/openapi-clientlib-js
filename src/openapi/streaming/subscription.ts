/* eslint-disable switch-case/no-case-curly, max-lines */
import { extend } from '../../utils/object';
import log from '../../log';
import {
    ACTION_SUBSCRIBE,
    ACTION_UNSUBSCRIBE,
    ACTION_MODIFY_PATCH,
    ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
    ACTION_MODIFY_REPLACE,
    ACTION_REMOVE,
} from './subscription-actions';
import SubscriptionQueue from './subscription-queue';
import type { QueuedItem } from './subscription-queue';
import ParserFacade from './parser/parser-facade';
import type { ITransport } from '../transport/transport-base';
import type { RequestOptions } from '../../types';
import type { StreamingMessage } from './types';

const updateTypes = {
    UPDATE_TYPE_SNAPSHOT: 1,
    UPDATE_TYPE_DELTA: 2,
} as const;

type SubscriptionUpdateTypes = typeof updateTypes[keyof typeof updateTypes];

const stateFlags = {
    SUBSCRIBE_REQUESTED: 1,
    SUBSCRIBED: 2,
    UNSUBSCRIBE_REQUESTED: 4,
    UNSUBSCRIBED: 8,
    PATCH_REQUESTED: 16,
    REPLACE_REQUESTED: 32,
    READY_FOR_UNSUBSCRIBE_BY_TAG: 64,
} as const;

export type SubscriptionState = typeof stateFlags[keyof typeof stateFlags];

export interface StreamingOptions {
    /**
     * headers to add to the subscription request
     */
    headers?: Record<string, string>;
    /**
     * A callback function that is invoked when an initial snapshot or update is received.
     * @param data - data received
     * @param updateType - either be subscription.UPDATE_TYPE_DELTA or subscription.UPDATE_TYPE_SNAPSHOT
     * @param subscription - the subscription where the update originated from
     */
    onUpdate?: (
        data: unknown,
        updateType: SubscriptionUpdateTypes,
        subscription: Subscription,
    ) => void;
    /**
     * A callback function that is invoked when an error occurs.
     * @param data - error data
     * @param subscription - the subscription the error occurred on
     */
    onError?: (data: unknown, subscription: Subscription) => void;
    /**
     * A callback function that is invoked after the last action is dequeued.
     * @param subscription - the subscription whose queue became empty
     */
    onQueueEmpty?: (subscription: Subscription) => void;
    /**
     * A callback function that is invoked on network error.
     * @param subscription - the subscription getting a network error
     */
    onNetworkError?: (subscription: Subscription) => void;
    /**
     * A callback function that is invoked when the subscription is created.
     * @param subscription - the subscription created
     */
    onSubscriptionCreated?: (subscription: Subscription) => void;
    /**
     * A callback function that is invoked when the subscription is ready to be removed.
     * @param subscription - the subscription ready to remove
     */
    onSubscriptionReadyToRemove?: (subscription: Subscription) => void;
}

export interface SubscriptionArgs {
    /**
     * The format for the subscription (passed to OpenAPI).
     */
    Format?: string | null;
    /**
     * The subscription arguments (passed to OpenAPI).
     */
    Arguments?: Record<string, unknown>;
    /**
     * The data refresh rate (passed to OpenAPI).
     */
    RefreshRate?: number;
    Top?: number;
    /**
     * The tag for the subscription (passed to OpenAPI).
     */
    Tag?: string;
}

interface SubscriptionSuccessResult {
    /**
     * The current state
     */
    State: 'active' | 'suspended';
    /**
     * The media type (RFC 2046), of the serialized data updates that are streamed to the client.
     */
    Format: string;
    /**
     * The streaming context id that this response is associated with.
     */
    ContextId: string;
    /**
     * The time (in seconds) that the client should accept the subscription to be inactive before considering it invalid.
     */
    InactivityTimeout: number;
    /**
     * Actual refresh rate assigned to the subscription according to the customers SLA.
     */
    RefreshRate: number;
    /**
     * Snapshot of the current data available
     */
    Snapshot: Record<string, unknown>;
    Schema?: string;
    SchemaName?: string;
}

/**
 * The static counter to generate unique reference id's.
 */
let referenceIdCounter = 1;

export function __forTestingOnlyResetReferenceId() {
    referenceIdCounter = 1;
}

const DEFAULT_REFRESH_RATE_MS = 1000;
const MIN_REFRESH_RATE_MS = 100;
const MIN_WAIT_FOR_PUBLISHER_TO_RESPOND_MS = 60000;

const FORMAT_PROTOBUF = 'application/x-protobuf';
const FORMAT_JSON = 'application/json';

const ERROR_UNSUPPORTED_FORMAT = 'UnsupportedSubscriptionFormat';

const LOG_AREA = 'Subscription';

type LogDiagnostic = {
    queue: ReadonlyArray<unknown>;
    type: string;
    [otherKey: string]: unknown;
};

/**
 * A subscription to a resource, which streams updates.
 *
 * This class should not be constructed directly, it should instead be created via the
 * Streaming.createSubscription factory method.
 */

class Subscription {
    UPDATE_TYPE_SNAPSHOT = 1 as const;
    UPDATE_TYPE_DELTA = 2 as const;

    STATE_SUBSCRIBE_REQUESTED = 1 as const;
    STATE_SUBSCRIBED = 2 as const;
    STATE_UNSUBSCRIBE_REQUESTED = 4 as const;
    STATE_UNSUBSCRIBED = 8 as const;
    STATE_PATCH_REQUESTED = 16 as const;
    STATE_REPLACE_REQUESTED = 32 as const;
    STATE_READY_FOR_UNSUBSCRIBE_BY_TAG = 64 as const;

    TRANSITIONING_STATES =
        this.STATE_SUBSCRIBE_REQUESTED |
        this.STATE_UNSUBSCRIBE_REQUESTED |
        this.STATE_PATCH_REQUESTED |
        this.STATE_REPLACE_REQUESTED |
        this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG;

    SUBSCRIBED_OR_SUBSCRIBING_STATES =
        this.STATE_SUBSCRIBED |
        this.STATE_SUBSCRIBE_REQUESTED |
        this.STATE_PATCH_REQUESTED |
        this.STATE_REPLACE_REQUESTED;

    /**
     * Defines the name of the property on data used to indicate that the data item is a deletion, rather than a
     * insertion / update.
     */
    OPENAPI_DELETE_PROPERTY = '__meta_deleted';

    /**
     * The streaming context id identifies the particular streaming connection that this subscription will use to subscribe.
     * It is updated while reconnecting with new connection or switching between on-premise and cloud streaming
     */
    streamingContextId: string;
    /**
     * Context id will be set when subscribed and will be used to unsubscribe
     */
    currentStreamingContextId: string | null = null;
    /**
     * The reference id is used to identify this subscription.
     */
    referenceId: string | null = null;
    /**
     * The last reference id a reset was called on, if we are throttling resets due to a publisher being down
     */
    publisherDownReferenceId: string | null = null;
    /**
     * The action queue.
     */
    queue = new SubscriptionQueue();
    onSubscriptionReadyToRemove?: (subscription: Subscription) => void;
    parser;
    onStateChangedCallbacks: Array<(state: SubscriptionState) => void> = [];
    transport: ITransport;
    servicePath;
    url;
    onSubscriptionCreated;
    subscriptionData;
    onUpdate;
    onError;
    onQueueEmpty;
    headers: Record<string, string> | undefined;
    onNetworkError;
    connectionAvailable;
    currentState: SubscriptionState = this.STATE_UNSUBSCRIBED;
    updatesBeforeSubscribed: null | StreamingMessage[] = null;
    networkErrorSubscribingTimer: null | number = null;
    inactivityTimeout: number | undefined;
    latestActivity: number | undefined;
    SchemaName: string | undefined | null;
    isDisposed = false;
    // keep track of last 3 reset timestamps
    resetTimeStamps: Array<number> = [];
    waitForPublisherToRespondTimer: null | number = null;
    logDiagnostics: Array<LogDiagnostic> = [];

    constructor(
        streamingContextId: string,
        transport: ITransport,
        servicePath: string,
        url: string,
        subscriptionArgs: SubscriptionArgs,
        options?: StreamingOptions,
    ) {
        this.streamingContextId = streamingContextId;

        /**
         * The parser, chosen based on provided format.
         */
        this.parser = ParserFacade.getParser(
            subscriptionArgs.Format,
            servicePath,
            url,
        );

        this.transport = transport;
        this.servicePath = servicePath;
        this.url = url;
        this.subscriptionData = subscriptionArgs;

        /**
         * Setting optional fields.
         */
        this.onSubscriptionCreated = options?.onSubscriptionCreated;
        this.onSubscriptionReadyToRemove = options?.onSubscriptionReadyToRemove;
        this.onUpdate = options?.onUpdate;
        this.onError = options?.onError;
        this.onQueueEmpty = options?.onQueueEmpty;
        this.headers = options?.headers && extend({}, options?.headers);
        this.onNetworkError = options?.onNetworkError;

        if (!this.subscriptionData.RefreshRate) {
            this.subscriptionData.RefreshRate = DEFAULT_REFRESH_RATE_MS;
        } else if (this.subscriptionData.RefreshRate < MIN_REFRESH_RATE_MS) {
            log.warn(
                LOG_AREA,
                'Low refresh rate - this has been rounded up to the minimum',
                { minimumRate: MIN_REFRESH_RATE_MS },
            );
            this.subscriptionData.RefreshRate = MIN_REFRESH_RATE_MS;
        }
        this.connectionAvailable = true;

        this.setState(this.STATE_UNSUBSCRIBED);
    }

    /**
     * If we get 3 resets within 1 minute then we wait for 1 minute
     * since it may indicate some problem with publishers or the frontend
     */
    private checkIfPublisherDown(isServerInitiated: boolean): boolean {
        this.resetTimeStamps.push(Date.now());

        if (this.resetTimeStamps.length >= 3) {
            this.resetTimeStamps = this.resetTimeStamps.slice(-3);
            if (
                !this.waitForPublisherToRespondTimer &&
                this.resetTimeStamps[2] - this.resetTimeStamps[0] <
                    MIN_WAIT_FOR_PUBLISHER_TO_RESPOND_MS
            ) {
                // 3 reset within 1 minute so wait for 1 minute for publisher to respond
                // this can also happen due to errors client side and in this case
                // this code prevents us from spamming the servers
                log.warn(LOG_AREA, '3 resets occurred within 1 minute.', {
                    url: this.url,
                    servicePath: this.servicePath,
                    isServerInitiated,
                });
                // this is the last reference id a reset was called on
                this.publisherDownReferenceId = this.referenceId;

                this.waitForPublisherToRespondTimer = window.setTimeout(() => {
                    this.waitForPublisherToRespondTimer = null;
                    const publisherDownReferenceId =
                        this.publisherDownReferenceId;
                    this.publisherDownReferenceId = null;

                    // only if nothing has changed - subscribed or mid-subscribed and the same reference id we got all the resets on
                    if (
                        publisherDownReferenceId === this.referenceId &&
                        (this.SUBSCRIBED_OR_SUBSCRIBING_STATES |
                            this.currentState) >
                            0
                    ) {
                        this.unsubscribeAndSubscribe();
                    }
                }, MIN_WAIT_FOR_PUBLISHER_TO_RESPOND_MS);

                return true;
            } else if (this.waitForPublisherToRespondTimer) {
                // update the reference id since a reset was called on it
                this.publisherDownReferenceId = this.referenceId;
            }
        }
        // if we have set a timer, ignore any resets - do nothing
        // if a subscribe occurs it will clear the timeout so that a new reset would work
        return Boolean(this.waitForPublisherToRespondTimer);
    }

    /**
     * Returns url used in subscribe post request.
     * Supports pagination (includes Top property in url request).
     */
    private getSubscribeUrl(url: string, subscriptionData: SubscriptionArgs) {
        if (!subscriptionData.Top) {
            return url;
        }

        return url + '?$top=' + subscriptionData.Top;
    }

    /**
     * Normalize subscription data, by removing
     * unsupported properties.
     */
    private normalizeSubscribeData(data: SubscriptionArgs) {
        if (data.hasOwnProperty('Top')) {
            delete data.Top;
        }
    }

    /**
     * Call to actually do a subscribe.
     */
    private subscribe({ replace = false } = {}) {
        const previousReferenceId = this.referenceId;

        // capture the reference id so we can tell in the response whether it is the latest call
        const referenceId = String(referenceIdCounter++);
        this.referenceId = referenceId;

        // reset any updates before subscribed
        this.updatesBeforeSubscribed = null;

        const subscribeUrl = this.getSubscribeUrl(
            this.url,
            this.subscriptionData,
        );

        const data = {
            ...this.subscriptionData,
            ContextId: this.streamingContextId,
            ReferenceId: referenceId,
            ReplaceReferenceId: replace ? previousReferenceId : undefined,
            KnownSchemas: this.parser.getSchemaNames(),
        };
        let options: RequestOptions = { body: data };

        if (this.headers) {
            options = { ...options, headers: { ...this.headers } };
        }

        this.normalizeSubscribeData(data);

        log.debug(LOG_AREA, 'Posting to create a subscription', {
            servicePath: this.servicePath,
            url: subscribeUrl,
        });
        this.setState(
            replace
                ? this.STATE_REPLACE_REQUESTED
                : this.STATE_SUBSCRIBE_REQUESTED,
        );

        this.currentStreamingContextId = this.streamingContextId;
        this.transport
            .post(this.servicePath, subscribeUrl, null, options)
            .then(this.onSubscribeSuccess.bind(this, referenceId))
            .catch(
                this.onSubscribeError.bind(
                    this,
                    referenceId,
                    previousReferenceId,
                ),
            );
    }

    /**
     * Does an actual unsubscribe.
     */
    private unsubscribe() {
        this.setState(this.STATE_UNSUBSCRIBE_REQUESTED);
        // capture the reference id so we can tell in the response whether it is the latest call
        const referenceId = this.referenceId as string;

        this.transport
            .delete(this.servicePath, this.url + '/{contextId}/{referenceId}', {
                contextId: this.currentStreamingContextId as string,
                referenceId,
            })
            .then(() => this.onUnsubscribeSuccess(referenceId))
            .catch(this.onUnsubscribeError.bind(this, referenceId));
    }

    /**
     * Does subscription modification through PATCH request
     * Only works for endpoints that support PATCH.
     */
    private modifyPatch(args?: QueuedItem['args']) {
        this.setState(this.STATE_PATCH_REQUESTED);
        const referenceId = this.referenceId;

        this.transport
            .patch(
                this.servicePath,
                this.url + '/{contextId}/{referenceId}',
                {
                    contextId: this.currentStreamingContextId as string,
                    referenceId: this.referenceId as string,
                },
                { body: args },
            )
            .then(() => this.onModifyPatchSuccess(referenceId))
            .catch(this.onModifyPatchError.bind(this, referenceId));
    }

    /**
     * Does subscription modification through delete & resubscribe in one HTTP call.
     * Works for all endpoints.
     */
    private modifyReplace() {
        this.queue.clearModifys();
        this.subscribe({ replace: true });
    }

    private unsubscribeByTagPending() {
        this.setState(this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG);
    }

    /**
     * Queues or performs an action based on the current state.
     * Supports queue for more then one action, to support consecutive modify requests,
     * which invoke unsubscribe and subscribe one after another.
     * @param action - action
     * @param args - args
     */
    private tryPerformAction(
        action: QueuedItem['action'],
        args?: QueuedItem['args'],
    ) {
        if (this.networkErrorSubscribingTimer) {
            // Clear the timeout - some other external event has happened which overrides the network timeout
            clearTimeout(this.networkErrorSubscribingTimer);
            this.networkErrorSubscribingTimer = null;

            // if a modify is attempted, whilst waiting to re-subscribe after a network error,
            // then since it is a user action initiated, try to re-subscribe immediately.
            // we do this by clearing the timer (above) and then converting the action into a subscribe
            // since if we modify during a unsubscribed state it will just log an error
            if (
                action === ACTION_MODIFY_REPLACE ||
                action === ACTION_MODIFY_PATCH
            ) {
                if (this.currentState === this.STATE_UNSUBSCRIBED) {
                    action = ACTION_SUBSCRIBE;
                } else {
                    log.error(
                        LOG_AREA,
                        'Unanticipated state in tryPerformAction with networkErrorSubscribingTimer',
                        {
                            state: this.currentState,
                            action,
                            url: this.url,
                            servicePath: this.servicePath,
                            connectionAvailable: this.connectionAvailable,
                            logDiagnostics: this.logDiagnostics,
                        },
                    );
                }
            }
        }

        if (
            !this.connectionAvailable ||
            this.TRANSITIONING_STATES & this.currentState
        ) {
            this.addLogDiagnostic({
                type: 'queingAction',
                queue: this.queue.items.slice(0),
                currentState: this.currentState,
                action,
            });
            this.queue.enqueue({ action, args });
        } else {
            this.performAction({ action, args });
        }
    }

    /**
     * Callback for when the subscription is ready to perform the next action.
     */
    private onReadyToPerformNextAction() {
        if (!this.connectionAvailable || this.queue.isEmpty()) {
            return;
        }
        this.performAction(this.queue.dequeue(), this.queue.isEmpty());
    }

    private addLogDiagnostic(item: LogDiagnostic) {
        this.logDiagnostics.push(item);
        if (this.logDiagnostics.length > 10) {
            this.logDiagnostics.shift();
        }
    }

    /**
     * Performs an action to a subscription based on the current state.
     * @param queuedAction - queuedAction
     * @param isLastQueuedAction - isLastQueuedAction
     */
    // eslint-disable-next-line complexity
    private performAction(
        queuedAction: QueuedItem | undefined,
        isLastQueuedAction?: boolean,
    ) {
        this.addLogDiagnostic({
            type: 'perform',
            queuedAction,
            queue: this.queue.items.slice(0),
        });
        if (!queuedAction) {
            return;
        }

        const { action, args } = queuedAction;

        switch (action) {
            case ACTION_REMOVE:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction Remove',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                                connectionAvailable: this.connectionAvailable,
                                logDiagnostics: this.logDiagnostics,
                            },
                        );
                }
                this.dispose();
                this.onSubscriptionReadyToRemove?.(this);
                break;

            case ACTION_SUBSCRIBE:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                        break;

                    case this.STATE_UNSUBSCRIBED:
                        this.queue.clearModifys();
                        this.subscribe();
                        break;

                    default:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction Subscribe',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                            },
                        );
                }
                break;

            case ACTION_MODIFY_PATCH:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                        this.modifyPatch(args);
                        break;

                    default:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction Patch',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                                logDiagnostics: this.logDiagnostics,
                            },
                        );
                }
                break;

            case ACTION_MODIFY_REPLACE:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                        this.modifyReplace();
                        break;

                    default:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction Replace',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                                logDiagnostics: this.logDiagnostics,
                            },
                        );
                }
                break;

            case ACTION_UNSUBSCRIBE:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                    case this.STATE_REPLACE_REQUESTED:
                        this.unsubscribe();
                        break;

                    case this.STATE_UNSUBSCRIBED:
                        break;

                    default:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction Unsubscribe',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                            },
                        );
                }
                break;

            case ACTION_UNSUBSCRIBE_BY_TAG_PENDING:
                switch (this.currentState) {
                    case this.STATE_SUBSCRIBED:
                    case this.STATE_UNSUBSCRIBED:
                        this.unsubscribeByTagPending();
                        break;

                    default:
                        log.error(
                            LOG_AREA,
                            'Unanticipated state in performAction UnsubscribeByTagPending',
                            {
                                state: this.currentState,
                                action,
                                url: this.url,
                                servicePath: this.servicePath,
                            },
                        );
                }
                break;

            default:
                throw new Error('unrecognised action ' + action);
        }

        if (this.onQueueEmpty && isLastQueuedAction) {
            this.onQueueEmpty(this);
        }

        // Required to manually rerun next action, because if nothing happens in given cycle,
        // next task from a queue will never be picked up.
        if (
            !this.queue.isEmpty() &&
            !(this.TRANSITIONING_STATES & this.currentState)
        ) {
            this.performAction(this.queue.dequeue(), this.queue.isEmpty());
        }
    }

    /**
     * Handles the response to the initial REST request that creates the subscription.
     * @param referenceId - referenceId
     * @param result - Result object
     */
    private onSubscribeSuccess(
        referenceId: string,
        result: { response: SubscriptionSuccessResult },
    ) {
        const responseData = result.response;

        if (referenceId !== this.referenceId) {
            log.info(
                LOG_AREA,
                'Received an Ok subscribe response for subscribing a subscription that has afterwards been reset - ignoring',
            );
            // we could send the contextId as well an attempt a unsubscribe, but its hard to guess what could lead to this.
            // - (reset by disconnect/reconnect from streaming) we started subscribing, then web sockets was disconnected, but
            //    the server doesn't know it yet
            //   - in this case the contextId should be changed and the server will drop the old session soon. we won't receive updates
            // - (reset by streaming control message) we started subscribing, then we get a web socket reset event before the rest server
            //    responded
            //   - in this case the contextId should be the same and the server itself has told us the subscription is dead
            // - (reset by heartbeat lapse) - this indicates a bug in the library since this shouldn't happen
            //   - in this case the contextId should be the same and we will probably get messages that cannot be matched to a subscription
            return;
        }

        this.setState(this.STATE_SUBSCRIBED);

        this.inactivityTimeout = responseData.InactivityTimeout || 0;

        if (responseData.InactivityTimeout === 0) {
            // this mostly happens when there is some other problem e.g. the response cannot be parsed
            log.warn(
                LOG_AREA,
                'inactivity timeout is 0 - interpreting as never timeout. Remove warning if normal.',
                result,
            );
        }

        this.onActivity();
        this.onSubscriptionCreated?.(this);

        // do not fire events if we are waiting to unsubscribe
        if (this.queue.peekAction() !== ACTION_UNSUBSCRIBE) {
            try {
                this.processSnapshot(responseData);
            } catch (error) {
                log.error(
                    LOG_AREA,
                    'Exception occurred in streaming snapshot update callback',
                    error,
                );
            }

            if (this.updatesBeforeSubscribed) {
                for (let i = 0; i < this.updatesBeforeSubscribed.length; i++) {
                    this.onStreamingData(this.updatesBeforeSubscribed[i]);
                }
            }
        }
        this.updatesBeforeSubscribed = null;

        // if processing the updatesBeforeSubscribed received above goes wrong or there
        // is a failure to add the schema, a reset
        // may occur and the state may now be unsubscribe requested.
        // if that is the case, we should not try and do anything here
        if (this.currentState === this.STATE_SUBSCRIBED) {
            this.onReadyToPerformNextAction();
        }
    }

    private cleanUpLeftOverSubscription(referenceId: string) {
        this.transport
            .delete(this.servicePath, this.url + '/{contextId}/{referenceId}', {
                contextId: this.currentStreamingContextId as string,
                referenceId,
            })
            .catch((error: any) => {
                log.debug(
                    LOG_AREA,
                    'Failed to remove left over request subscription',
                    error,
                );
            });
    }

    /**
     * Called when a subscribe errors
     * @param response - response
     */
    private onSubscribeError(
        referenceId: string,
        previousReferenceId: string | null | undefined,
        response: {
            response?: { Message: string; ErrorCode: string };
            isNetworkError: boolean;
        },
    ) {
        if (referenceId !== this.referenceId) {
            log.debug(
                LOG_AREA,
                'Received an error response for subscribing a subscription that has afterwards been reset - ignoring',
            );
            return;
        }

        // If a modify came in whilst we are subscribing, we want to clear it
        // we don't want it firing in our error'd - unsubscribed state
        // and if we do succeed in a new subscribe, it will be with the updated arguments
        const hasNewArgsNow = this.queue.clearModifys();

        const nextAction = this.queue.peekAction();
        const willUnsubscribe = nextAction && nextAction & ACTION_UNSUBSCRIBE;
        const isReplace = this.currentState === this.STATE_REPLACE_REQUESTED;

        this.addLogDiagnostic({
            type: 'SubscribeError',
            queue: this.queue.items.slice(0),
            isReplace,
        });

        this.setState(this.STATE_UNSUBSCRIBED);

        // if we are a duplicate response, we should unsubscribe now
        const isDupeRequest =
            response?.response?.Message ===
            'Subscription Key (Streaming Session, Reference Id) already in use';

        if (isDupeRequest) {
            log.warn(LOG_AREA, `A duplicate request occurred subscribing`, {
                response,
                url: this.url,
                servicePath: this.servicePath,
                ContextId: this.currentStreamingContextId,
                ReferenceId: referenceId,
                subscriptionData: this.subscriptionData,
            });

            this.cleanUpLeftOverSubscription(referenceId);

            // if a duplicate request we reset as it should pass 2nd time around
            if (!willUnsubscribe) {
                this.tryPerformAction(ACTION_SUBSCRIBE);
                return;
            }
        } else if (isReplace && previousReferenceId) {
            // a replace error may have failed to cleanup the current subscription
            this.cleanUpLeftOverSubscription(previousReferenceId);
        }

        const errorCode = response?.response
            ? response.response.ErrorCode
            : null;

        if (
            errorCode === ERROR_UNSUPPORTED_FORMAT &&
            this.subscriptionData.Format === FORMAT_PROTOBUF
        ) {
            log.warn(
                LOG_AREA,
                `Protobuf is not supported, falling back to JSON`,
                {
                    response,
                    url: this.url,
                    subscriptionData: this.subscriptionData,
                },
            );

            // Fallback to JSON format if specific endpoint doesn't support PROTOBUF format.
            this.fallbackToJSON();

            if (!willUnsubscribe) {
                this.tryPerformAction(ACTION_SUBSCRIBE);
                return;
            }
        }

        const isNetworkError = response?.isNetworkError;
        if (isNetworkError && !willUnsubscribe) {
            // its possible we sent the request before we noticed internet is unavailable
            // also possible this is a one off
            // its also possible that the subscribe succeeded - but that is unlikely and hard to handle

            log.debug(
                LOG_AREA,
                `A network error occurred subscribing to ${this.url}`,
                {
                    response,
                    url: this.url,
                    servicePath: this.servicePath,
                    ContextId: this.currentStreamingContextId,
                    ReferenceId: referenceId,
                    subscriptionData: this.subscriptionData,
                },
            );

            // let streaming know we got a network error
            this.networkErrorSubscribingTimer = window.setTimeout(() => {
                this.networkErrorSubscribingTimer = null;

                // we did not go offline and we did not receive any commands in the meantime
                // otherwise this timeout would be cancelled.
                // so we can assume this was a one off network error and we can try again
                this.tryPerformAction(ACTION_SUBSCRIBE);
            }, 5000);

            if (this.onNetworkError) {
                this.onNetworkError(this);
            }

            return;
        }

        if (!isNetworkError) {
            log.info(LOG_AREA, `An error occurred subscribing to ${this.url}`, {
                response,
                url: this.url,
                servicePath: this.servicePath,
                ContextId: this.currentStreamingContextId,
                ReferenceId: referenceId,
                isReplace,
                subscriptionData: this.subscriptionData,
            });
        }

        // if the arguments were changed and we are not going to unsubscribe
        // then subscribe now
        if (hasNewArgsNow && !willUnsubscribe) {
            this.tryPerformAction(ACTION_SUBSCRIBE);
            return;
        }

        // if we are unsubscribed, do not fire the error handler
        if (!willUnsubscribe) {
            if (this.onError) {
                this.onError(response, this);
            }
        }

        this.onReadyToPerformNextAction();
    }

    /**
     * Called after subscribe is successful
     */
    private onUnsubscribeSuccess(referenceId: string | null) {
        if (referenceId !== this.referenceId) {
            log.debug(
                LOG_AREA,
                'Unsubscribed a subscription that has afterwards been reset - ignoring',
            );
            // we were unsubscribing when reset and the unsubscribe succeeded
            // return because we may have been asked to subscribe after resetting
            return;
        }

        this.setState(this.STATE_UNSUBSCRIBED);
        this.onReadyToPerformNextAction();
    }

    /**
     * Called when a unsubscribe errors
     * @param response - response
     */
    private onUnsubscribeError(referenceId: string | null, response: unknown) {
        if (referenceId !== this.referenceId) {
            log.debug(
                LOG_AREA,
                'Received an error response for unsubscribing a subscription that has afterwards been reset - ignoring',
            );
            return;
        }

        this.setState(this.STATE_UNSUBSCRIBED);

        // It seems this can happen if the streaming server unsubscribes just before us (e.g. d/c)
        log.info(LOG_AREA, 'An error occurred unsubscribing', {
            response,
            url: this.url,
        });
        this.onReadyToPerformNextAction();
    }

    /**
     * Called after modify patch is successful
     * @param referenceId - referenceId
     * @param response - response
     */
    private onModifyPatchSuccess(referenceId: string | null) {
        if (referenceId !== this.referenceId) {
            log.debug(
                LOG_AREA,
                'Received a response for modify patch a subscription that has afterwards been reset - ignoring',
            );
            return;
        }

        this.setState(this.STATE_SUBSCRIBED);
        this.onReadyToPerformNextAction();
    }

    /**
     * Called when a unsubscribe errors
     * @param response - response
     */
    private onModifyPatchError(referenceId: string | null, response: unknown) {
        if (referenceId !== this.referenceId) {
            log.debug(
                LOG_AREA,
                'Received an error response for modify patch a subscription that has afterwards been reset - ignoring',
            );
            return;
        }

        this.setState(this.STATE_SUBSCRIBED);
        log.warn(LOG_AREA, `An error occurred patching ${this.url}`, {
            response,
            url: this.url,
        });
        this.onReadyToPerformNextAction();
    }

    private setState(state: SubscriptionState) {
        this.currentState = state;
        for (let i = 0; i < this.onStateChangedCallbacks.length; i++) {
            this.onStateChangedCallbacks[i](state);
        }
    }

    /**
     * Resets the subscription activity
     */
    onActivity() {
        this.latestActivity = new Date().getTime();
    }

    /**
     * Add a callback to be invoked when the subscription state changes.
     */
    addStateChangedCallback(callback: (state: SubscriptionState) => void) {
        const index = this.onStateChangedCallbacks.indexOf(callback);

        if (index === -1) {
            this.onStateChangedCallbacks.push(callback);
        }
    }

    /**
     * Remove a callback which was invoked when the subscription state changes.
     */
    removeStateChangedCallback(callback: (...args: unknown[]) => void) {
        const index = this.onStateChangedCallbacks.indexOf(callback);

        if (index > -1) {
            this.onStateChangedCallbacks.splice(index, 1);
        }
    }

    processUpdate(message: StreamingMessage, type: SubscriptionUpdateTypes) {
        let nextMessage;
        try {
            nextMessage = {
                ...message,
                // @ts-expect-error - FIXME this.SchemaName may be undefined,
                // according to the logic we should have parser instance accepting missing schema name (JSON  parser)
                // consider making a check if a proper instance is used
                Data: this.parser.parse(message.Data, this.SchemaName),
            };
        } catch (error) {
            log.error(LOG_AREA, 'Error occurred parsing Data', {
                error,
                schemaName: this.SchemaName,
                servicePath: this.servicePath,
                url: this.url,
            });

            // if we cannot understand an update we should re-subscribe and fallback to JSON
            this.fallbackToJSON();
            this.reset(false);
            return;
        }

        this.onUpdate?.(nextMessage, type, this);
    }

    private fallbackToJSON() {
        this.subscriptionData.Format = FORMAT_JSON;
        this.parser = ParserFacade.getParser(
            FORMAT_JSON,
            this.servicePath,
            this.url,
        );
    }

    processSnapshot(response: SubscriptionSuccessResult) {
        if (response.Schema && response.SchemaName) {
            try {
                this.parser.addSchema(response.Schema, response.SchemaName);
            } catch (error) {
                log.error(
                    LOG_AREA,
                    'Fallback to json after failure to add schema',
                    { error },
                );
                this.fallbackToJSON();
                this.reset(false);
                return;
            }
        }

        if (response.SchemaName) {
            this.SchemaName = response.SchemaName;
        } else {
            // If SchemaName is missing, trying to use last valid schema name from parser as an fallback.
            this.SchemaName = this.parser.getSchemaName();

            if (this.subscriptionData.Format === FORMAT_PROTOBUF) {
                if (!this.SchemaName) {
                    log.warn(
                        LOG_AREA,
                        'Missing schema name in response and parser, falling back to JSON',
                        {
                            schemaName: this.SchemaName,
                            servicePath: this.servicePath,
                            url: this.url,
                        },
                    );
                    // If SchemaName is missing both in response and parser cache, it means that openapi doesn't support protobuf for this endpoint.
                    // In such scenario, falling back to default parser.
                    this.fallbackToJSON();
                    // reset otherwise we do nothing and continue to get protobuf
                    this.reset(false);
                    return;
                }

                log.warn(
                    LOG_AREA,
                    'Missing schema name in open api response, this may cause protobuf errors during service upgrade',
                    {
                        schemaName: this.SchemaName,
                        servicePath: this.servicePath,
                        url: this.url,
                    },
                );
            }
        }

        // Serialization of Snapshot is not yet supported.
        this.onUpdate?.(response.Snapshot, this.UPDATE_TYPE_SNAPSHOT, this);
    }

    /**
     * Reset happens when the server notices that a publisher is dead or when
     * it misses some messages so it doesn't know who is dead (reset all)
     * This may be called with a burst of messages. The intent is that we queue
     * an operation to unsubscribe, wait for that to finish and then subscribe
     * This waiting means that if we get further resets whilst unsubscribing, we
     * can ignore them. It also ensures that we don't hit the subscription limit
     * because the subscribe manages to get to the server before the unsubscribe.
     */
    reset(isServerInitiated: boolean) {
        if (!this.checkIfPublisherDown(isServerInitiated)) {
            this.unsubscribeAndSubscribe();
        }
    }

    /**
     * Does a unsubscribe and then schedules a subscribe for when it is finished unsubscribing
     * Call this only if this is not a error scenario. Normally you should use reset
     * So that we track the reset
     */
    unsubscribeAndSubscribe() {
        this.addLogDiagnostic({
            type: 'unsubscribeAndSubscribe',
            queue: this.queue.items.slice(0),
            currentState: this.currentState,
        });

        switch (this.currentState) {
            case this.STATE_UNSUBSCRIBED:
            case this.STATE_UNSUBSCRIBE_REQUESTED:
                // do not do anything - even if the next action is to subscribe, we can go ahead and do that when the unsubscribe response comes back
                return;

            case this.STATE_PATCH_REQUESTED:
            case this.STATE_SUBSCRIBE_REQUESTED:
            case this.STATE_REPLACE_REQUESTED:
            case this.STATE_SUBSCRIBED: {
                // we could have been in the process of subscribing when we got a reset. We can only assume that the new thing we are subscribing to
                // was also reset. or we are subscribed / patch requested.. either way we now need to unsubscribe.
                // if it was in process of subscribing it will now unsubscribe once the subscribe returns.
                //
                // If we were patching we *could* try and ignore the current patch
                // but that starts getting complicated because the patch callback might change state
                // if the callback comes back before subscribe changes the reference id.
                // See the PR removing this feature here: https://github.com/SaxoBank/openapi-clientlib-js/pull/747

                // If we are going to unsubscribe as our final action, we shouldn't subscribe
                // after unsubscribing
                const isSubscribedAfterActions =
                    this.queue.peekIsSubscribed(true);

                this.onUnsubscribe(true);

                if (!isSubscribedAfterActions) {
                    // avoid subscribing since we were not before this was called
                    return;
                }

                // subscribe... this will go ahead unless the connection is unavailable, after unsubscribe has occurred
                this.onSubscribe();
                break;
            }

            case this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG:
                // We are about to unsubscribe by tag, so no need to do anything
                return;

            default:
                log.error(
                    LOG_AREA,
                    'unsubscribeAndSubscribe was called but subscription is in an unknown state',
                    {
                        currentState: this.currentState,
                    },
                );
        }
    }

    /**
     * Try to subscribe.
     */
    onSubscribe({ replace = false } = {}) {
        if (this.isDisposed) {
            throw new Error(
                'Subscribing a disposed subscription - you will not get data',
            );
        }

        this.tryPerformAction(ACTION_SUBSCRIBE, { replace });
    }

    /**
     * Remove the subscription once it has finished processing previous actions
     */
    onRemove() {
        if (this.isDisposed) {
            throw new Error('Removing a disposed subscription');
        }

        this.tryPerformAction(ACTION_REMOVE);
    }

    /**
     * Try to modify.
     * @param newArgs - Updated arguments of modified subscription.
     */
    onModify(
        newArgs?: Record<string, unknown>,
        options?:
            | {
                  isPatch?: false;
                  isReplace: true;
              }
            | {
                  isPatch: true;
                  patchArgsDelta: Record<string, unknown>;
                  isReplace?: false;
              }
            | {
                  isPatch?: false;
                  isReplace?: false;
              },
    ) {
        if (this.isDisposed) {
            throw new Error(
                'Modifying a disposed subscription - you will not get data',
            );
        }

        this.subscriptionData.Arguments = newArgs;
        if (options?.isPatch) {
            if (!options.patchArgsDelta) {
                throw new Error('Modify options patchArgsDelta is not defined');
            }
            this.tryPerformAction(ACTION_MODIFY_PATCH, options.patchArgsDelta);
        } else if (options?.isReplace) {
            this.tryPerformAction(ACTION_MODIFY_REPLACE);
        } else {
            // resubscribe with new arguments
            this.onUnsubscribe(true);
            this.onSubscribe();
        }
    }

    /**
     * Try to unsubscribe.
     */
    onUnsubscribe(forceUnsubscribe?: boolean) {
        if (this.isDisposed) {
            log.warn(
                LOG_AREA,
                'Unsubscribing a disposed subscription - this is not necessary',
            );
        }

        this.tryPerformAction(ACTION_UNSUBSCRIBE, {
            force: Boolean(forceUnsubscribe),
        });
    }

    /**
     * Tells us we are now disposed
     */
    dispose() {
        this.isDisposed = true;
    }

    /**
     * Tell the subscription that the connection is unavailable.
     */
    onConnectionUnavailable() {
        this.connectionAvailable = false;
        if (this.networkErrorSubscribingTimer) {
            // we recently received a network error, so now we can just wait until we are online again
            clearTimeout(this.networkErrorSubscribingTimer);
            this.networkErrorSubscribingTimer = null;
            this.tryPerformAction(ACTION_SUBSCRIBE);
        }
    }

    /**
     * Tell the subscription that the connection is available and it can perform any queued action.
     */
    onConnectionAvailable() {
        this.connectionAvailable = true;

        // if we waited to do something and we are not transitioning, then try something
        if (!(this.TRANSITIONING_STATES & this.currentState)) {
            this.onReadyToPerformNextAction();
        }
    }

    /**
     * Handles the 'data' event raised by Streaming.
     * @returns  false if the update is not for this subscription
     */
    onStreamingData(message: StreamingMessage): false | void {
        this.onActivity();

        switch (this.currentState) {
            // if we are unsubscribed or trying to unsubscribe then ignore the data
            case this.STATE_UNSUBSCRIBE_REQUESTED:
                return;

            case this.STATE_UNSUBSCRIBED:
                return false;

            // we received a delta before we got initial data
            case this.STATE_SUBSCRIBE_REQUESTED:
            case this.STATE_REPLACE_REQUESTED:
                this.updatesBeforeSubscribed =
                    this.updatesBeforeSubscribed || [];
                this.updatesBeforeSubscribed.push(message);
                return;

            // the normal state, go ahead
            case this.STATE_SUBSCRIBED:
            case this.STATE_PATCH_REQUESTED:
                break;

            default:
                log.error(LOG_AREA, 'Unanticipated state onStreamingData', {
                    state: this.currentState,
                    url: this.url,
                    servicePath: this.servicePath,
                });
        }

        const nextAction = this.queue.peek();
        const willUnsubscribeForced =
            nextAction &&
            nextAction.action & ACTION_UNSUBSCRIBE &&
            nextAction.args?.force;
        if (willUnsubscribeForced) {
            // We need to only ignore it if it is a forced unsubscribe. That's because a normal unsubscribe if we are not
            // currently subscribed may be cancelled
            return;
        }

        try {
            this.processUpdate(message, this.UPDATE_TYPE_DELTA);
        } catch (error) {
            log.error(
                LOG_AREA,
                'Exception occurred in streaming delta update callback',
                {
                    error: {
                        message: error.message,
                        stack: error.stack,
                    },
                    payload: message,
                    url: this.url,
                    servicePath: this.servicePath,
                },
            );
        }
    }

    /**
     * Handles a heartbeat from the server.
     */
    onHeartbeat() {
        if (
            this.currentState === this.STATE_SUBSCRIBE_REQUESTED ||
            this.currentState === this.STATE_REPLACE_REQUESTED
        ) {
            log.debug(
                LOG_AREA,
                'Received heartbeat for a subscription we havent subscribed to yet',
                { url: this.url, servicePath: this.servicePath },
            );
        }
        this.onActivity();
    }

    /**
     * Handle a subscription pending unsubscribe by tag.
     */
    onUnsubscribeByTagPending() {
        this.tryPerformAction(ACTION_UNSUBSCRIBE_BY_TAG_PENDING);
    }

    /**
     * Handled a subscription having been unsubscribed by tag.
     */
    onUnsubscribeByTagComplete() {
        this.setState(this.STATE_UNSUBSCRIBED);
        this.onReadyToPerformNextAction();
    }

    /**
     * Returns whether this subscription is ready to be unsubscribed by tag after it has been requested.
     */
    isReadyForUnsubscribeByTag() {
        return this.currentState === this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG;
    }

    /**
     * Returns the time in ms till the subscription would be orphaned.
     * @param now - The current time as a reference (e.g. Date.now()).
     */
    timeTillOrphaned(now: number) {
        // this works because there are no suspended and resume states.
        // once subscribed, orphan finder will be notified.
        if (
            !this.connectionAvailable ||
            this.latestActivity === undefined ||
            this.inactivityTimeout === undefined ||
            this.inactivityTimeout === 0 ||
            this.currentState === this.STATE_UNSUBSCRIBED ||
            this.currentState === this.STATE_UNSUBSCRIBE_REQUESTED ||
            this.currentState === this.STATE_SUBSCRIBE_REQUESTED ||
            this.currentState === this.STATE_REPLACE_REQUESTED
        ) {
            return Infinity;
        }

        // Follows the same pattern as the old library, not giving any grace period for receiving a heartbeat
        // if it was required, it could be added on here
        const diff = now - this.latestActivity;

        return this.inactivityTimeout * 1000 - diff;
    }
}

export default Subscription;
