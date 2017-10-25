/**
 * Queue (FIFO) of pending subscription actions. Allows for easier abstraction of managing list of pending actions.
 * In addition to standard queue implementation, provides:
 *  - merging consecutive duplicated actions
 *  - merging of uneccessary combinations: ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE, is merged to ACTION_UNSUBSCRIBE.
 *
 * @module saxo/openapi/streaming/subscription queue
 * @ignore
 */
import {
    ACTION_SUBSCRIBE,
    ACTION_UNSUBSCRIBE,
    ACTION_MODIFY_SUBSCRIBE,
    ACTION_MODIFY_PATCH,
    ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
} from './subscription-actions';

function getLastItem() {
    if (this.isEmpty()) {
        return undefined;
    }
    return this.items[this.items.length - 1];
}

/**
 * Queue (FIFO) for storing pending subscription actions.
 * @constructor
 */
function SubscriptionQueue() {
    this.items = [];
}

/**
 * Add pending action to a queue and making sure that we remove unecessary actions like:
 * - duplicates.
 * - ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE.
 *
 * @param {Object} queuedItem - action with arguments to add to the queue.
 */
SubscriptionQueue.prototype.enqueue = function(queuedItem) {

    if (!queuedItem.action) {
        throw new Error('Subscription queued action is invalid');
    }
    if (this.isEmpty()) {
        this.items.push(queuedItem);
        return;
    }

    const { action } = queuedItem;
    const prevAction = getLastItem.call(this).action;

    // ..UM => UM
    if (action === ACTION_MODIFY_SUBSCRIBE) {
        if (prevAction === ACTION_UNSUBSCRIBE) {
            this.items = [{ action: ACTION_UNSUBSCRIBE }, queuedItem];
        }
        return;
    }

    // MM => M, UU => U, SS => S
    if (action === prevAction && action !== ACTION_MODIFY_PATCH) {
        return;
    }

    // MS => M
    if (prevAction === ACTION_MODIFY_SUBSCRIBE && action === ACTION_SUBSCRIBE) {
        return;
    }

    // US => S
    // SU => U
    if (prevAction === ACTION_UNSUBSCRIBE && action === ACTION_SUBSCRIBE ||
        prevAction === ACTION_SUBSCRIBE && action === ACTION_UNSUBSCRIBE ||
        prevAction === ACTION_UNSUBSCRIBE && action === ACTION_UNSUBSCRIBE_BY_TAG_PENDING) {
        this.items.splice(-1);
    }

    this.items.push(queuedItem);
};

/**
 * Returns the action from the beggining of a queue without removing it.
 * @return {Number} Next action.
 */
SubscriptionQueue.prototype.peekAction = function() {
    if (this.isEmpty()) {
        return undefined;
    }
    return this.items[0].action;
};

/**
 * Removes and returns the action from the beginning of a queue.
 * @return {Number|undefined} First action, if queue is not empty. Otherwise undefined.
 */
SubscriptionQueue.prototype.dequeue = function() {

    if (this.isEmpty()) {
        return undefined;
    }

    const nextItem = this.items.shift();

    if (this.isEmpty()) {
        return nextItem;
    }
    const nextAction = nextItem.action;
    const lastItem = getLastItem.call(this);
    const lastAction = lastItem.action;

    if (nextAction === ACTION_MODIFY_SUBSCRIBE && lastAction !== ACTION_UNSUBSCRIBE) {
        // M, U, S => M
        // M, U, M, U, M => M
        // M, P, P => M
        this.reset();
        return nextItem;
    }

    if (lastAction === ACTION_UNSUBSCRIBE || lastAction === ACTION_UNSUBSCRIBE_BY_TAG_PENDING) {
        // M, U, S, U => U
        // S, U => U
        // S, U, S, U => U
        // P, U => U
        this.reset();
        return lastItem;
    }

    return nextItem;
};

/**
 * Resets queue.
 */
SubscriptionQueue.prototype.reset = function() {
    this.items = [];
};

/**
 * Returns true if queue is empty.
 * @return {boolean} True if empty.
 */
SubscriptionQueue.prototype.isEmpty = function() {
    return this.items.length === 0;
};

export default SubscriptionQueue;
