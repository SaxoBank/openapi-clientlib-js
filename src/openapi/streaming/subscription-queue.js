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
function SubscriptionQueue(maxSize = 2) {
	this.items = [];
	this.maxSize = maxSize;
}

/**
 * Add pending action to a queue and making sure that we remove unecessary actions like:
 * - duplicates.
 * - ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE.
 *
 * @param {Number} action - action to add to the queue.
 */
SubscriptionQueue.prototype.enqueue = function(action) {
	this.items.push(action);

	if (this.items.length < this.maxSize) {
		return;
	}

	for (let i = this.items.length - 2; i >= 0; i--) {
		let task = this.items[i];
		let nextTask = this.items[i + 1];

		if (task === ACTION_SUBSCRIBE && nextTask === ACTION_UNSUBSCRIBE ||
			task === ACTION_UNSUBSCRIBE && nextTask === ACTION_SUBSCRIBE ||
			task === ACTION_SUBSCRIBE && nextTask === ACTION_MODIFY_SUBSCRIBE ||
			task === ACTION_MODIFY_SUBSCRIBE && nextTask === ACTION_SUBSCRIBE ||
			task === ACTION_MODIFY_SUBSCRIBE && nextTask === ACTION_UNSUBSCRIBE ||
			task === nextTask
		)
		{
			this.items.splice(i, 1);
		}
	}

	if (this.items.length > this.maxSize) {
		// Removes elements from the beginning of a queue, to match maximum allowed size.
		this.items.splice(0, this.items.length - this.maxSize);
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
SubscriptionQueue.prototype.reset = function () {
	this.items = [];
};

/**
 * Returns true if queue is empty.
 * @return {boolean} True if empty.
 */
SubscriptionQueue.prototype.isEmpty = function () {
	return this.items.length === 0;
};

export default SubscriptionQueue;
