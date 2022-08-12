import {
    ACTION_SUBSCRIBE,
    ACTION_UNSUBSCRIBE,
    ACTION_MODIFY_PATCH,
    ACTION_MODIFY_REPLACE,
    ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
} from './subscription-actions';
import type { SubscriptionAction } from './subscription-actions';

export interface QueuedItem {
    action: SubscriptionAction;
    args?: { force?: boolean; [p: string]: any };
}

/**
 * Queue (FIFO) of pending subscription actions. Allows for easier abstraction of managing list of pending actions.
 * In addition to standard queue implementation, provides:
 *  - merging consecutive duplicated actions
 *  - merging of uneccessary combinations: ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE, is merged to ACTION_UNSUBSCRIBE.
 */
class SubscriptionQueue {
    items: QueuedItem[] = [];

    private getLastItem() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items[this.items.length - 1];
    }

    /**
     * Add pending action to a queue and making sure that we remove unecessary actions like:
     * - duplicates.
     * - ACTION_SUBSCRIBE action before ACTION_UNSUBSCRIBE.
     *
     * @param queuedItem - action with arguments to add to the queue.
     */
    /* eslint-disable-next-line complexity */
    enqueue(queuedItem: QueuedItem) {
        if (!queuedItem.action) {
            throw new Error('Subscription queued action is invalid');
        }

        if (this.isEmpty()) {
            this.items.push(queuedItem);
            return;
        }

        const { action } = queuedItem;
        const prevItem = this.getLastItem() as QueuedItem; // we know that there is at least one item at this point
        const prevAction = prevItem.action;

        // unless its a patch, doing the same thing twice is a noop
        if (action === prevAction && action !== ACTION_MODIFY_PATCH) {
            // if its a unsubscribe, make sure the forces get joined
            if (
                action === ACTION_UNSUBSCRIBE &&
                queuedItem.args?.force &&
                prevItem.args &&
                !prevItem.args.force
            ) {
                // remove the unsubscribe without force because we are adding with force
                this.items.splice(-1);
                // try again so we process the force remove consequences
                this.enqueue(queuedItem);
                return;
            }

            return;
        }

        if (
            // only remove the unsubscribe if it is not a forced unsubscribe
            (prevAction === ACTION_UNSUBSCRIBE &&
                action === ACTION_SUBSCRIBE &&
                !prevItem.args?.force) ||
            // unsubscribing when a subscribe is queued can always eliminate the subscribe
            (prevAction === ACTION_SUBSCRIBE &&
                (action === ACTION_UNSUBSCRIBE ||
                    action === ACTION_UNSUBSCRIBE_BY_TAG_PENDING)) ||
            // unsubscribing when we need to patch or replace can happen if we are sure the unsubscribe will happen
            ((prevAction === ACTION_MODIFY_PATCH ||
                prevAction === ACTION_MODIFY_REPLACE) &&
                ((action === ACTION_UNSUBSCRIBE && queuedItem.args?.force) ||
                    action === ACTION_UNSUBSCRIBE_BY_TAG_PENDING)) ||
            // We can switch a force unsubscribe for a unsubscribe by tag because there is no logic
            // to remove the unsubscribe by tag if its followed by a subscribe...
            (prevAction === ACTION_UNSUBSCRIBE &&
                action === ACTION_UNSUBSCRIBE_BY_TAG_PENDING)
        ) {
            this.items.splice(-1);

            // try again - this allows us to remove multiple items
            // e.g.
            // unsubscribe force
            // subscribe
            // unsubscribe (/by tag)
            this.enqueue(queuedItem);
            return;
        }

        this.items.push(queuedItem);
    }

    /**
     * This is called at the point of subscribing or on a subscribe error.
     * We know at that point we do not need any follow up modifys
     * or subscribes.
     */
    clearModifys() {
        const newItems = [];
        let itemRemoved = false;
        let reachedNonModifySubscribe = false;
        for (let i = 0; i < this.items.length; i++) {
            const action = this.items[i].action;
            if (
                reachedNonModifySubscribe ||
                (action !== ACTION_SUBSCRIBE &&
                    action !== ACTION_MODIFY_PATCH &&
                    action !== ACTION_MODIFY_REPLACE)
            ) {
                newItems.push(this.items[i]);
                reachedNonModifySubscribe = true;
            } else {
                itemRemoved = true;
            }
        }
        this.items = newItems;
        return itemRemoved;
    }

    /**
     * Returns the action from the beginning of a queue without removing it.
     * @returns  Next action.
     */
    peekAction() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items[0].action;
    }

    /**
     * Peeks the next action
     */
    peek(): QueuedItem | undefined {
        return this.items[0];
    }

    /**
     * Looks to see if the end state after processing actions is to be unsubscribed or not
     * If the actions are indeterminate (for example, no actions) then it returns the current
     * state passed as a argument
     */
    peekIsSubscribed(isSubscribedNow: boolean): boolean {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const action = this.items[i].action;
            if (action === ACTION_SUBSCRIBE) {
                return true;
            }
            if (action === ACTION_UNSUBSCRIBE) {
                return false;
            }
        }
        return isSubscribedNow;
    }

    /**
     * Removes and returns the action from the beginning of a queue.
     * @returns  First action, if queue is not empty. Otherwise undefined.
     */
    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }

        const nextItem = this.items.shift();

        if (this.isEmpty()) {
            return nextItem;
        }

        // because there might be a modify patch at the end, we see if there is a unsubscribe somewhere in the queue
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const { action } = item;
            if (
                action === ACTION_UNSUBSCRIBE ||
                action === ACTION_UNSUBSCRIBE_BY_TAG_PENDING
            ) {
                this.items = this.items.slice(i + 1);
                return item;
            }
        }

        return nextItem;
    }

    /**
     * Resets queue.
     */
    reset() {
        this.items = [];
    }

    /**
     * @returns True if empty.
     */
    isEmpty() {
        return this.items.length === 0;
    }
}

export default SubscriptionQueue;
