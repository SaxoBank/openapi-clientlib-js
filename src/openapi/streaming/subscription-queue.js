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
} from './subscription-actions';

/**
 * Queue (FIFO) for storing pending subscription actions.
 * @param maxSize {Number} - Maximum queue size. Defaults to 2, which works best for current needs.
 * @constructor
 */
function SubscriptionQueue(maxSize) {
    this.items = [];
    this.maxSize = maxSize || 2;
}

/**
 * Add pending action to a queue and making sure that we remove unecessary actions like:
 * - duplicates.
 * - ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE.
 *
 * @param {Object} queuedAction - action with arguments to add to the queue.
 */
SubscriptionQueue.prototype.enqueue = function(queuedAction) {

    if (!queuedAction.action) {
        throw new Error('Subscription queued action is invalid');
    }
    const { action } = queuedAction;

    if (!this.canEnqueueAction(action)) {
        return;
    }

    if (action === ACTION_UNSUBSCRIBE ||
        action === ACTION_SUBSCRIBE) {
        this.reset();
    } else if (action === ACTION_MODIFY_SUBSCRIBE) {
        this.removeAllExcept(ACTION_UNSUBSCRIBE);
    }

    this.items.push(queuedAction);

    if (this.items.length > this.maxSize) {
        // Removes elements from the beginning of a queue, to match maximum allowed size.
        this.items.splice(0, this.items.length - this.maxSize);
    }
};

SubscriptionQueue.prototype.canEnqueueAction = function canEnqueueAction(nextAction) {

    // Removing subscribe in such case to keep requested subscription modification.
    if (this.containsAction(ACTION_MODIFY_SUBSCRIBE) && nextAction === ACTION_SUBSCRIBE) {
        return false;
    }
    return true;
};

SubscriptionQueue.prototype.containsAction = function(action) {
    let i = 0;

    while (i < this.items.length) {
        if (this.items[i].action === action) {
            return true;
        }
        i++;
    }
    return false;
};

SubscriptionQueue.prototype.removeAllExcept = function(action) {
    let i = 0;

    while (i < this.items.length) {
        if (this.items[i].action !== action) {
            this.items.splice(i, 1);
            continue;
        }
        i++;
    }
};

/**
 * Returns the action from the beggining of a queue without removing it.
 * @return {Number} Next action.
 */
SubscriptionQueue.prototype.peek = function() {
    return this.items[0];
};

/**
 * Removes and returns the action from the beginning of a queue.
 * @return {Number|undefined} First action, if queue is not empty. Otherwise undefined.
 */
SubscriptionQueue.prototype.dequeue = function() {
    return this.items.shift();
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
