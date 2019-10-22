/**
 * @module saxo/openapi/streaming/subscription
 * @ignore
 */
import { extend } from '../../utils/object';
import log from '../../log';
import {
    ACTION_SUBSCRIBE,
    ACTION_UNSUBSCRIBE,
    ACTION_MODIFY_SUBSCRIBE,
    ACTION_MODIFY_PATCH,
    ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
} from './subscription-actions';
import SubscriptionQueue from './subscription-queue';
import ParserFacade from './parser/parser-facade';

// -- Local variables section --

/**
 * The static counter to generate unique reference id's.
 */
let referenceIdCounter = 1;

const DEFAULT_REFRESH_RATE_MS = 1000;
const MIN_REFRESH_RATE_MS = 100;

const FORMAT_PROTOBUF = 'application/x-protobuf';
const FORMAT_JSON = 'application/json';

const ERROR_UNSUPPORTED_FORMAT = 'UnsupportedSubscriptionFormat';

const LOG_AREA = 'Subscription';

// -- Local methods section --

/**
 * Returns url used in subscribe post request.
 * Supports pagination (includes Top property in url request).
 */
function getSubscribeUrl(url, subscriptionData) {
    if (!subscriptionData.Top) {
        return url;
    }

    return url + '?$top=' + subscriptionData.Top;
}

/**
 * Normalize subscription data, by removing
 * unsupported properties.
 */
function normalizeSubscribeData(data) {
    if (data.hasOwnProperty('Top')) {
        delete data.Top;
    }
}

/**
 * Call to actually do a subscribe.
 */
function subscribe() {
    // capture the reference id so we can tell in the response whether it is the latest call
    const referenceId = String(referenceIdCounter++);
    this.referenceId = referenceId;

    // reset any updates before subscribed
    this.updatesBeforeSubscribed = null;

    const subscribeUrl = getSubscribeUrl(this.url, this.subscriptionData);

    const data = extend({}, this.subscriptionData, {
        ContextId: this.streamingContextId,
        ReferenceId: referenceId,
        KnownSchemas: this.parser.getSchemaNames(),
    });

    normalizeSubscribeData(data);

    const args = { body: data };

    if (this.headers) {
        args.headers = this.headers;
    }

    log.debug(LOG_AREA, 'starting..', { serviceGroup: this.serviceGroup, url: subscribeUrl });
    setState.call(this, this.STATE_SUBSCRIBE_REQUESTED);

    this.transport.post(this.serviceGroup, subscribeUrl, null, args)
        .then(onSubscribeSuccess.bind(this, referenceId))
        .catch(onSubscribeError.bind(this, referenceId));
}

/**
 * Does an actual unsubscribe.
 */
function unsubscribe() {
    setState.call(this, this.STATE_UNSUBSCRIBE_REQUESTED);
    // capture the reference id so we can tell in the response whether it is the latest call
    const referenceId = this.referenceId;

    this.transport.delete(this.serviceGroup, this.url + '/{contextId}/{referenceId}', {
        contextId: this.streamingContextId,
        referenceId,
    })
        .then(onUnsubscribeSuccess.bind(this, referenceId))
        .catch(onUnsubscribeError.bind(this, referenceId));
}
/**
 * Does subscription modification through PATCH request
 */
function modifyPatch(args) {
    setState.call(this, this.STATE_PATCH_REQUESTED);
    const referenceId = this.referenceId;

    this.transport.patch(this.serviceGroup, this.url + '/{contextId}/{referenceId}', {
        contextId: this.streamingContextId,
        referenceId: this.referenceId,
    }, { body: args })
        .then(onModifyPatchSuccess.bind(this, referenceId))
        .catch(onModifyPatchError.bind(this, referenceId));
}

function unsubscribeByTagPending() {
    setState.call(this, this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG);
}

/**
 * Queues or performs an action based on the current state.
 * Supports queue for more then one action, to support consecutive modify requests,
 * which invoke unsubscribe and subscribe one after another.
 * @param action
 * @param args
 */
function tryPerformAction(action, args) {
    if (!this.connectionAvailable || this.TRANSITIONING_STATES & this.currentState) {
        this.queue.enqueue({ action, args });
    } else {
        performAction.call(this, { action, args });
    }
}

/**
 * Callback for when the subscription is ready to perform the next action.
 */
function onReadyToPerformNextAction() {
    if (!this.connectionAvailable || this.queue.isEmpty()) {
        return;
    }
    performAction.call(this, this.queue.dequeue(), this.queue.isEmpty());
}

/**
 * Performs an action to a subscription based on the current state.
 * @param queuedAction
 * @param isLastQueuedAction
 */
function performAction(queuedAction, isLastQueuedAction) {
    const { action, args } = queuedAction;

    switch (action) {
        case ACTION_SUBSCRIBE:
        case ACTION_MODIFY_SUBSCRIBE:
            switch (this.currentState) {
                case this.STATE_SUBSCRIBED:
                    break;

                case this.STATE_UNSUBSCRIBED:
                    subscribe.call(this);
                    break;

                default:
                    log.error(LOG_AREA, 'unanticipated state', { state: this.currentState, action });
            }
            break;

        case ACTION_MODIFY_PATCH:
            switch (this.currentState) {
                case this.STATE_SUBSCRIBED:
                    modifyPatch.call(this, args);
                    break;

                default:
                    log.error(LOG_AREA, 'unanticipated state', { state: this.currentState, action });
            }
            break;

        case ACTION_UNSUBSCRIBE:
            switch (this.currentState) {
                case this.STATE_SUBSCRIBED:
                    unsubscribe.call(this);
                    break;

                case this.STATE_UNSUBSCRIBED:
                    break;

                default:
                    log.error(LOG_AREA, 'unanticipated state', { state: this.currentState, action });
            }
            break;

        case ACTION_UNSUBSCRIBE_BY_TAG_PENDING:
            switch (this.currentState) {
                case this.STATE_SUBSCRIBED:
                case this.STATE_UNSUBSCRIBED:
                    unsubscribeByTagPending.call(this);
                    break;

                default:
                    log.error(LOG_AREA, 'unanticipated state', { state: this.currentState, action });
            }
            break;

        default:
            throw new Error('unrecognised action ' + action);
    }

    if (this.onQueueEmpty && isLastQueuedAction) {
        this.onQueueEmpty();
    }

    // Required to manually rerun next action, because if nothing happens in given cycle,
    // next task from a queue will never be picked up.
    if (!this.queue.isEmpty() && !(this.TRANSITIONING_STATES & this.currentState)) {
        performAction.call(this, this.queue.dequeue(), this.queue.isEmpty());
    }
}

/**
 * Handles the response to the initial REST request that creates the subscription.
 * {Object} result
 * {string} result.State The current state (Active/Suspended)
 * {string} result.Format The media type (RFC 2046), of the serialized data updates that are streamed to the client.
 * {string} result.ContextId The streaming context id that this response is associated with.
 * {number=0} result.InactivityTimeout The time (in seconds) that the client should accept the subscription to be inactive
 *          before considering it invalid.
 * {number=0} result.RefreshRate Actual refresh rate assigned to the subscription according to the customers SLA.
 * {Object} result.Snapshot Snapshot of the current data available
 */
function onSubscribeSuccess(referenceId, result) {

    const responseData = result.response;

    if (referenceId !== this.referenceId) {
        log.error(LOG_AREA, 'Received an Ok subscribe response for subscribing a subscription that has afterwards been reset - ignoring');
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

    setState.call(this, this.STATE_SUBSCRIBED);

    this.inactivityTimeout = responseData.InactivityTimeout || 0;

    if (this.inactivityTimeout === 0) {
        log.warn(LOG_AREA, 'inactivity timeout is 0 - interpreting as never timeout. Remove warning if normal.', result);
    }

    onActivity.call(this);

    if (this.onSubscriptionCreated) {
        this.onSubscriptionCreated();
    }

    // do not fire events if we are waiting to unsubscribe
    if (this.queue.peekAction() !== ACTION_UNSUBSCRIBE) {
        try {
            this.processSnapshot(responseData);
        } catch (ex) {
            log.error(LOG_AREA, 'exception occurred in streaming snapshot update callback');
        }

        if (this.updatesBeforeSubscribed) {
            for (let i = 0; i < this.updatesBeforeSubscribed.length; i++) {
                this.onStreamingData(this.updatesBeforeSubscribed[i]);
            }
        }
    }
    this.updatesBeforeSubscribed = null;

    onReadyToPerformNextAction.call(this);
}

/**
 * Called when a subscribe errors
 * @param response
 */
function onSubscribeError(referenceId, response) {
    if (referenceId !== this.referenceId) {
        log.debug(LOG_AREA, 'Received an error response for subscribing a subscription that has afterwards been reset - ignoring');
        return;
    }

    setState.call(this, this.STATE_UNSUBSCRIBED);
    log.error(LOG_AREA, 'An error occurred subscribing', {
        response,
        url: this.url,
        ContextId: this.streamingContextId,
        ReferenceId: this.referenceId,
        subscriptionData: this.subscriptionData,
    });

    const errorCode = response && response.response ? response.response.ErrorCode : null;

    if (errorCode === ERROR_UNSUPPORTED_FORMAT && this.subscriptionData && this.subscriptionData.Format === FORMAT_PROTOBUF) {
        // Fallback to JSON format if specific endpoint doesn't support PROTOBUF format.
        this.subscriptionData.Format = FORMAT_JSON;
        this.parser = ParserFacade.getParser(FORMAT_JSON, this.serviceGroup, this.url);

        tryPerformAction.call(this, ACTION_SUBSCRIBE);
        return;
    }

    // if we are unsubscribed, do not fire the error handler
    if (this.queue.peekAction() !== ACTION_UNSUBSCRIBE) {
        if (this.onError) {
            this.onError(response);
        }
    }

    onReadyToPerformNextAction.call(this);
}

/**
 * Called after subscribe is successful
 * @param referenceId
 * @param response
 */
function onUnsubscribeSuccess(referenceId, response) {
    if (referenceId !== this.referenceId) {
        log.debug(LOG_AREA, 'Received an error response for subscribing a subscription that has afterwards been reset - ignoring');
        // we were unsubscribing when reset and the unsubscribe succeeded
        // return because we may have been asked to subscribe after resetting
        return;
    }

    setState.call(this, this.STATE_UNSUBSCRIBED);
    onReadyToPerformNextAction.call(this);
}

/**
 * Called when a unsubscribe errors
 * @param response
 */
function onUnsubscribeError(referenceId, response) {
    if (referenceId !== this.referenceId) {
        log.error(LOG_AREA, 'Received an error response for unsubscribing a subscription that has afterwards been reset - ignoring');
        return;
    }

    setState.call(this, this.STATE_UNSUBSCRIBED);
    log.error(LOG_AREA, 'An error occurred unsubscribing', { response, url: this.url });
    onReadyToPerformNextAction.call(this);
}

/**
 * Called after modify patch is successful
 * @param referenceId
 * @param response
 */
function onModifyPatchSuccess(referenceId, response) {
    if (referenceId !== this.referenceId) {
        log.debug(LOG_AREA, 'Received a response for modify patch a subscription that has afterwards been reset - ignoring');
        return;
    }

    setState.call(this, this.STATE_SUBSCRIBED);
    onReadyToPerformNextAction.call(this);
}

/**
 * Called when a unsubscribe errors
 * @param response
 */
function onModifyPatchError(referenceId, response) {
    if (referenceId !== this.referenceId) {
        log.error(LOG_AREA, 'Received an error response for modify patch a subscription that has afterwards been reset - ignoring');
        return;
    }

    setState.call(this, this.STATE_SUBSCRIBED);
    log.error(LOG_AREA, 'An error occurred patching', { response, url: this.url });
    onReadyToPerformNextAction.call(this);
}

/**
 * Resets the subscription activity
 */
function onActivity() {
    this.latestActivity = new Date().getTime();
}

function setState(state) {
    this.currentState = state;
    for (let i = 0; i < this.onStateChangedCallbacks.length; i++) {
        this.onStateChangedCallbacks[i](state);
    }
}

// -- Exported methods section --

/**
 * A subscription to a resource, which streams updates.
 *
 * This class should not be constructed directly, it should instead be created via the
 * {@link saxo.openapi.Streaming#createSubscription} factory method.
 *
 * @class
 * @alias saxo.openapi.StreamingSubscription
 */
// eslint-disable-next-line max-params
function Subscription(streamingContextId, transport, serviceGroup, url, subscriptionArgs, onSubscriptionCreated, options = {}) {

    /**
     * The streaming context id identifies the particular streaming connection that this subscription will use.
     * @type {string}
     */
    this.streamingContextId = streamingContextId;

    /**
     * The reference id is used to identify this subscription.
     * @type {string}
     */
    this.referenceId = null;

    /**
     * The action queue.
     * @type {SubscriptionQueue}
     */
    this.queue = new SubscriptionQueue();

    /**
     * The parser, chosen based on provided format.
     */
    this.parser = ParserFacade.getParser(subscriptionArgs.Format, serviceGroup, url);

    this.onStateChangedCallbacks = [];

    this.transport = transport;
    this.serviceGroup = serviceGroup;
    this.url = url;
    this.onSubscriptionCreated = onSubscriptionCreated;
    this.subscriptionData = subscriptionArgs;

    /**
     * Setting optional fields.
     */
    this.onUpdate = options.onUpdate;
    this.onError = options.onError;
    this.onQueueEmpty = options.onQueueEmpty;
    this.headers = options.headers;

    if (!this.subscriptionData.RefreshRate) {
        this.subscriptionData.RefreshRate = DEFAULT_REFRESH_RATE_MS;
    } else if (this.subscriptionData.RefreshRate < MIN_REFRESH_RATE_MS) {
        log.warn(LOG_AREA, 'Low refresh rate. This has been rounded up to the minimum.', { minimumRate: MIN_REFRESH_RATE_MS });
        this.subscriptionData.RefreshRate = MIN_REFRESH_RATE_MS;
    }
    this.connectionAvailable = true;

    setState.call(this, this.STATE_UNSUBSCRIBED);
}

Subscription.prototype.UPDATE_TYPE_SNAPSHOT = 1;
Subscription.prototype.UPDATE_TYPE_DELTA = 2;

Subscription.prototype.STATE_SUBSCRIBE_REQUESTED = 0x1;
Subscription.prototype.STATE_SUBSCRIBED = 0x2;
Subscription.prototype.STATE_UNSUBSCRIBE_REQUESTED = 0x4;
Subscription.prototype.STATE_UNSUBSCRIBED = 0x8;
Subscription.prototype.STATE_PATCH_REQUESTED = 0x10;

Subscription.prototype.TRANSITIONING_STATES =
    Subscription.prototype.STATE_SUBSCRIBE_REQUESTED |
    Subscription.prototype.STATE_UNSUBSCRIBE_REQUESTED |
    Subscription.prototype.STATE_PATCH_REQUESTED |
    Subscription.prototype.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG;

/**
 * Defines the name of the property on data used to indicate that the data item is a deletion, rather than a
 * insertion / update.
 * @type {string}
 */
Subscription.prototype.OPENAPI_DELETE_PROPERTY = '__meta_deleted';

/**
 * Add a callback to be invoked when the subscription state changes.
 */
Subscription.prototype.addStateChangedCallback = function(callback) {
    const index = this.onStateChangedCallbacks.indexOf(callback);

    if (index === -1) {
        this.onStateChangedCallbacks.push(callback);
    }
};

/**
 * Remove a callback which was invoked when the subscription state changes.
 */
Subscription.prototype.removeStateChangedCallback = function(callback) {
    const index = this.onStateChangedCallbacks.indexOf(callback);

    if (index > -1) {
        this.onStateChangedCallbacks.splice(index, 1);
    }
};

Subscription.prototype.processUpdate = function(message, type) {
    const nextMessage = extend({}, message, {
        Data: this.parser.parse(message.Data, this.SchemaName),
    });

    this.onUpdate(nextMessage, type);
};

Subscription.prototype.processSnapshot = function(response) {
    if (response.Schema && response.SchemaName) {
        this.SchemaName = response.SchemaName;
        this.parser.addSchema(response.Schema, response.SchemaName);
    }

    if (!response.SchemaName) {
        // If SchemaName is missing, trying to use last valid schema name from parser as an fallback.
        this.SchemaName = this.parser.getSchemaName();

        if (this.subscriptionData.Format === FORMAT_PROTOBUF && !this.SchemaName) {
            // If SchemaName is missing both in response and parser cache, it means that openapi doesn't support protobuf fot this endpoint.
            // In such scenario, falling back to default parser.
            this.parser = ParserFacade.getParser(ParserFacade.getDefaultFormat(), this.serviceGroup, this.url);
        }
    }

    // Serialization of Snapshot is not yet supported.
    this.onUpdate(response.Snapshot, this.UPDATE_TYPE_SNAPSHOT);
};

/**
 * This assumes the subscription is dead and subscribes again. If unsubscribed or awaiting a unsubscribe, this is ignored.
 * It should be used in the case of errors, such as the subscription becoming orphaned and when the server asks us to reset a subscription.
 * @private
 */
Subscription.prototype.reset = function() {

    switch (this.currentState) {
        case this.STATE_UNSUBSCRIBED:
        case this.STATE_UNSUBSCRIBE_REQUESTED:
            // do not do anything if we are on our way to unsubscribed unless the next action would be to subscribe
            if (this.queue.peekAction() & ACTION_SUBSCRIBE) {
                break;
            }
            return;

        case this.STATE_SUBSCRIBE_REQUESTED:
            // we could have been in the process of subscribing when disconnected. we would need to subscribe with a new streamingContextId
            break;

        case this.STATE_SUBSCRIBED:
        case this.STATE_PATCH_REQUESTED:
            this.onUnsubscribe();
            break;

        case this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG:
            break;

        default:
            log.error(LOG_AREA, 'reset was called but subscription is in an unknown state');
            return;
    }

    this.queue.reset();

    // do not unsubscribe because a reset happens when the existing subscription is broken
    //  * on a new connection (new context id, subscription will be cleaned up)
    //  * server reset instruction (server is telling us subscription is broken)
    //  * subscription is orphaned (meaning subscription is dead).

    // set the state to unsubscribed, since that is what we are now assuming
    setState.call(this, this.STATE_UNSUBSCRIBED);

    // subscribe... because the state is unsubscribed this will go ahead unless the connection is unavailable
    this.onSubscribe();
};

/**
 * Try to subscribe.
 * @param {Boolean} modify - The modify flag indicates that subscription action is part of subscription modification.
 *                           If true, any unsubscribe before subscribe will be kept. Otherwise they are dropped.
 * @private
 */
Subscription.prototype.onSubscribe = function(modify) {
    if (this.isDisposed) {
        throw new Error('Subscribing a disposed subscription - you will not get data');
    }

    tryPerformAction.call(this, modify ? ACTION_MODIFY_SUBSCRIBE : ACTION_SUBSCRIBE);
};

/**
 * Try to modify.
 * @param {Object} newArgs - Updated arguments of modified subscription.
 * @private
 */
Subscription.prototype.onModify = function(newArgs, options) {

    if (this.isDisposed) {
        throw new Error('Modifying a disposed subscription - you will not get data');
    }

    this.subscriptionData.Arguments = newArgs;
    if (options && options.isPatch) {
        if (!options.patchArgsDelta) {
            throw new Error('Modify options patchArgsDelta is not defined');
        }
        tryPerformAction.call(this, ACTION_MODIFY_PATCH, options.patchArgsDelta);
    } else {
        // resubscribe with new arguments
        this.onUnsubscribe();
        this.onSubscribe(true);
    }
};

/**
 * Try to unsubscribe.
 * @private
 */
Subscription.prototype.onUnsubscribe = function() {

    if (this.isDisposed) {
        log.warn('Unsubscribing a disposed subscription - this is not necessary');
    }

    tryPerformAction.call(this, ACTION_UNSUBSCRIBE);
};

/**
 * Tells us we are now disposed
 * @private
 */
Subscription.prototype.dispose = function() {

    this.isDisposed = true;
};

/**
 * Tell the subscription that the connection is unavailable.
 * @private
 */
Subscription.prototype.onConnectionUnavailable = function() {
    this.connectionAvailable = false;
};

/**
 * Tell the subscription that the connection is available and it can perform any queued action.
 * @private
 */
Subscription.prototype.onConnectionAvailable = function() {
    this.connectionAvailable = true;

    // if we waited to do something and we are not transitioning, then try something
    if (!(this.TRANSITIONING_STATES & this.currentState)) {
        onReadyToPerformNextAction.call(this);
    }
};

/**
 * Handles the 'data' event raised by Streaming.
 * @private
 * @returns {boolean} false if the update is not for this subscription
 */
Subscription.prototype.onStreamingData = function(message) {
    onActivity.call(this);

    switch (this.currentState) {
        // if we are unsubscribed or trying to unsubscribe then ignore the data
        case this.STATE_UNSUBSCRIBE_REQUESTED:
            return;

        case this.STATE_UNSUBSCRIBED:
            return false;

        // we received a delta before we got initial data
        case this.STATE_SUBSCRIBE_REQUESTED:
            this.updatesBeforeSubscribed = this.updatesBeforeSubscribed || [];
            this.updatesBeforeSubscribed.push(message);
            return;

        // the normal state, go ahead
        case this.STATE_SUBSCRIBED:
        case this.STATE_PATCH_REQUESTED:
            break;

        default:
            log.error(LOG_AREA, 'unanticipated state', this.currentState);
    }

    try {
        this.processUpdate(message, this.UPDATE_TYPE_DELTA);
    } catch (error) {
        log.error(LOG_AREA, 'exception occurred in streaming delta update callback', error);
    }
};

/**
 * Handles a heartbeat from the server.
 * @private
 */
Subscription.prototype.onHeartbeat = function() {
    if (this.currentState === this.STATE_SUBSCRIBE_REQUESTED) {
        log.warn(LOG_AREA, 'received heartbeat for a subscription we havent subscribed to yet', { url: this.url, serviceGroup: this.serviceGroup });
    }
    onActivity.call(this);
};

/**
 * Handle a subscription pending unsubscribe by tag.
 */
Subscription.prototype.onUnsubscribeByTagPending = function() {
    tryPerformAction.call(this, ACTION_UNSUBSCRIBE_BY_TAG_PENDING);
};

/**
 * Handled a subscription having been unsubscribed by tag.
 */
Subscription.prototype.onUnsubscribeByTagComplete = function() {
    setState.call(this, this.STATE_UNSUBSCRIBED);
    onReadyToPerformNextAction.call(this);
};

/**
 * Returns whether this subscription is ready to be unsubscribed by tag after it has been requested.
 */
Subscription.prototype.isReadyForUnsubscribeByTag = function() {
    return this.currentState === this.STATE_READY_FOR_UNSUBSCRIBE_BY_TAG;
};

/**
 * Returns the time in ms till the subscription would be orphaned.
 * @param now - The current time as a reference (e.g. Date.now()).
 * @private
 */
Subscription.prototype.timeTillOrphaned = function(now) {

    // this works because there are no suspended and resume states.
    // once subscribed, orphan finder will be notified.
    if (!this.connectionAvailable ||
        this.inactivityTimeout === 0 ||
        this.currentState === this.STATE_UNSUBSCRIBED ||
        this.currentState === this.STATE_UNSUBSCRIBE_REQUESTED ||
        this.currentState === this.STATE_SUBSCRIBE_REQUESTED) {
        return Infinity;
    }

    // Follows the same pattern as the old library, not giving any grace period for receiving a heartbeat
    // if it was required, it could be added on here

    const diff = now - this.latestActivity;

    return this.inactivityTimeout * 1000 - diff;
};

// -- Export section --

export default Subscription;
