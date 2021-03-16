/**
 * Finds subscriptions that have become orphaned. This only happens if an open api server goes down, but it requires that
 * the orphaned subscription is restarted. A simpler implementation would be to have a setTimeout/clearTimeout onActivity
 * in each subscription, but this class was abstracted for performance in order to reduce the number of setTimeouts/clearTimeouts
 * - with any number of subscriptions at the smallest refresh interval, with millions of updates per second, this class only
 * checks subscriptions when a new one is started and then once per second overall.
 *
 * @module saxo/openapi/streaming/orphan finder
 * @ignore
 */

import log from '../../log';

// -- Local variables section --

const LOG_AREA = 'StreamingOrphanFinder';

const DEFAULT_START_DELAY = 1000;
const MAX_UPDATE_DELAY = 5000;

// -- Local methods section --

function onUpdateTimeout() {
    this.nextUpdateTimeoutId = null;
    this.update();
}

// -- Exported methods section --

function StreamingOrphanFinder(subscriptions, onOrphanFound, startDelay) {
    if (!subscriptions || !onOrphanFound) {
        throw new Error(
            'Missing required parameters: subscription or onOrphanFound in streaming orphan finder',
        );
    }

    this.subscriptions = subscriptions;
    this.nextUpdateTime = Infinity;
    this.onOrphanFound = onOrphanFound;

    // delay to avoid orphaning subscriptions when just connected before heartbeats that are queued up get to us
    this.startDelay = startDelay || DEFAULT_START_DELAY;
    this.enabled = false;
}

/**
 * Starts the orphan-finder.
 * It will delay reporting orphans for a set amount of time
 */
StreamingOrphanFinder.prototype.start = function () {
    this.enabled = true;
    this.minCheckTime = Date.now() + this.startDelay;
    this.update();
};

StreamingOrphanFinder.prototype.stop = function () {
    if (this.nextUpdateTimeoutId) {
        clearTimeout(this.nextUpdateTimeoutId);
        this.nextUpdateTimeoutId = null;
        this.nextUpdateTime = Infinity;
    }
    this.enabled = false;
};

StreamingOrphanFinder.prototype.update = function () {
    if (!this.enabled) {
        return;
    }

    const now = Date.now();
    const oldNextUpdateIn = this.nextUpdateTime - now; // old next Update In
    let newNextUpdateIn = Infinity; // new oldNextUpdateIn
    let foundNextUpdate = false;
    const orphanedSubscriptions = [];

    // if this update is running very late then the chances are the phone is in background mode
    // or has just come out of it. If so, we delay checking
    if (oldNextUpdateIn < -MAX_UPDATE_DELAY) {
        log.info(
            LOG_AREA,
            'Update occurred much later than requested, assuming wake from sleep and will retry',
            oldNextUpdateIn,
        );

        this.minCheckTime = now + this.startDelay;
        this.nextUpdateTimeoutId = setTimeout(
            onUpdateTimeout.bind(this),
            this.startDelay,
        );
        this.nextUpdateTime = now + this.startDelay;
        return;
    }

    for (let i = 0; i < this.subscriptions.length; i++) {
        const subscription = this.subscriptions[i];
        const timeTillOrphaned = subscription.timeTillOrphaned(now);
        if (timeTillOrphaned <= 0) {
            orphanedSubscriptions.push(subscription);
        } else if (timeTillOrphaned < newNextUpdateIn) {
            foundNextUpdate = true;
            newNextUpdateIn = timeTillOrphaned;
        }
    }

    // if we are still in the period between starting and the startDelay
    if (this.minCheckTime > now) {
        const startDelayEndsIn = this.minCheckTime - now;

        // we want to delay doing anything in case we just re-connected and the heartbeats are queued
        if (orphanedSubscriptions.length) {
            // if we were going to orphan a subscription, delay until the startDelay period is over
            orphanedSubscriptions.length = 0;
            newNextUpdateIn = startDelayEndsIn;
            foundNextUpdate = true;
        } else if (startDelayEndsIn > newNextUpdateIn) {
            // we weren't going to orphan anything, but if the next update is planned before the end of the start delay
            // then postpone it to the start delay

            newNextUpdateIn = startDelayEndsIn;
        }
    }

    for (let i = 0; i < orphanedSubscriptions.length; i++) {
        this.onOrphanFound(orphanedSubscriptions[i]);
    }

    if (oldNextUpdateIn === newNextUpdateIn) {
        return;
    }

    if (this.nextUpdateTimeoutId) {
        clearTimeout(this.nextUpdateTimeoutId);
        this.nextUpdateTimeoutId = null;
    }

    if (foundNextUpdate) {
        this.nextUpdateTimeoutId = setTimeout(
            onUpdateTimeout.bind(this),
            newNextUpdateIn,
        );
    }

    // use now even though it may be out of date in order that multiple updates for roughly the same time do not clear/set timeouts
    // if there was a difference in time, then the next time this was called that difference would be detected as a shorter timeout
    // and it would be rescheduled. To improve this, get time again and change oldNextUpdateIn by the difference.
    this.nextUpdateTime = now + newNextUpdateIn;
};

// -- Export section --

export default StreamingOrphanFinder;
