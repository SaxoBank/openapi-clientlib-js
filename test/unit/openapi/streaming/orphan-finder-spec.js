import { installClock, uninstallClock, global } from '../../utils';

const StreamingOrphanFinder = saxo.openapi._StreamingOrphanFinder;

describe('openapi StreamingOrphanFinder', () => {

    let streamingOrphanFinder;
    let orphanFoundCallback;
    let orphanedSubscription;
    let notOrphanedSubscription;
    let orphanIn20Subscription;
    let orphanIn30Subscription;
    let orphanedSubscriptionTime;
    let notOrphanedSubscriptionTime;
    let transitioningSubscriptionTime;
    let orphanIn20SubscriptionTime;
    let orphanIn30SubscriptionTime;

    function mockSubscription(timeTillOrphanedObj) {
        const subscription = jasmine.createSpyObj('subscription', ['timeTillOrphaned']);
        subscription.timeTillOrphaned.and.callFake(() => timeTillOrphanedObj.time);
        return subscription;
    }

    beforeEach(() => {
        orphanedSubscriptionTime = { time: -1 };
        orphanedSubscription = mockSubscription(orphanedSubscriptionTime);

        notOrphanedSubscriptionTime = { time: 1 };
        notOrphanedSubscription = mockSubscription(notOrphanedSubscriptionTime);

        transitioningSubscriptionTime = { time: Infinity };
        mockSubscription(transitioningSubscriptionTime);

        orphanIn20SubscriptionTime = { time: 20000 };
        orphanIn20Subscription = mockSubscription(orphanIn20SubscriptionTime);

        orphanIn30SubscriptionTime = { time: 30000 };
        orphanIn30Subscription = mockSubscription(orphanIn30SubscriptionTime);

        orphanFoundCallback = jasmine.createSpy('orphanFound');

        installClock();
    });
    afterEach(() => uninstallClock());

    it('requires subscriptions and callback', () => {
        expect(function() {
            new StreamingOrphanFinder([], function() {});
        }).not.toThrow();
        expect(function() {
            new StreamingOrphanFinder(null, function() {});
        }).toThrow();
        expect(function() {
            new StreamingOrphanFinder([]);
        }).toThrow();
    });

    it('does not do anything when constructed or updated with an empty list', () => {
        streamingOrphanFinder = new StreamingOrphanFinder([], orphanFoundCallback);
        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();

        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
    });

    it('resets orphaned subscriptions', () => {
        const subscriptions = [];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        streamingOrphanFinder.start();
        jasmine.clock().tick(2000);

        subscriptions.push(orphanedSubscription);
        streamingOrphanFinder.update();

        expect(orphanFoundCallback.calls.count()).toEqual(1);
        expect(orphanFoundCallback.calls.argsFor(0)).toEqual([orphanedSubscription]);
    });

    it('reschedules its update if a sooner update comes in', () => {
        const subscriptions = [orphanIn30Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 30000);

        jasmine.clock().tick(10000);
        orphanIn30SubscriptionTime.time = 20000;
        orphanIn20SubscriptionTime.time = 10000;

        subscriptions.push(orphanIn20Subscription);
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 10000);
    });

    it('does not reschedule if the time is unchanged', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 20000);

        jasmine.clock().tick(10000);
        orphanIn30SubscriptionTime.time = 20000;
        orphanIn20SubscriptionTime.time = 10000;

        subscriptions.push(orphanIn30Subscription);
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 10000);
    });

    it('removes timer if no subscriptions have a time till orphaned 1', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 20000);

        orphanIn20SubscriptionTime.time = 0;
        jasmine.clock().tick(20000);

        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();

        expect(orphanFoundCallback.calls.count()).toEqual(1);
        expect(orphanFoundCallback.calls.argsFor(0)).toEqual([orphanIn20Subscription]);
    });

    it('removes timer when you call dispose', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 20000);

        streamingOrphanFinder.stop();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
    });

    it('has a start delay that waits before reporting orphans', () => {
        const subscriptions = [orphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);
        streamingOrphanFinder.start();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 1000);

        jasmine.clock().tick(500);

        streamingOrphanFinder.update();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 500);

        jasmine.clock().tick(500);

        expect(orphanFoundCallback.calls.count()).toEqual(1);
        expect(orphanFoundCallback.calls.argsFor(0)).toEqual([orphanedSubscription]);
    });

    it('has a start delay that waits until up before checking', () => {
        const subscriptions = [notOrphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);
        streamingOrphanFinder.start();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 1000);

        jasmine.clock().tick(500);

        streamingOrphanFinder.update();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 500);

        jasmine.clock().tick(500);

        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 1);
    });

    it('does not do anything when updated when stopped', () => {
        const subscriptions = [orphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
    });

    it('delays tests if the update has been called very late', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(subscriptions, orphanFoundCallback);

        const mockedSetTimeout = global.setTimeout;
        global.setTimeout = jasmine.createSpy('setTimeout'); // hide timeout calls from happening

        streamingOrphanFinder.start();
        expect(orphanFoundCallback.calls.count()).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 20000);

        expect(global.setTimeout.calls.count()).toEqual(1); // start scheduled one update

        jasmine.clock().tick(30 * 60 * 1000);  // now go forward 30 minutes
        orphanIn20SubscriptionTime.time = -100000; // make our subscription orphaned
        expect(orphanFoundCallback.calls.count()).toEqual(0);

        let updateCall = global.setTimeout.calls.argsFor(0)[0];
        updateCall(); // we schedule the timer, happening late, it should detect it and not report orphaned, in case a phone went to sleep and was just awoken

        expect(orphanFoundCallback.calls.count()).toEqual(0); // so it has not reported it
        expect(global.setTimeout.calls.count()).toEqual(2); // but it has scheduled a new update

        updateCall = global.setTimeout.calls.argsFor(1)[0];
        const delayBeforeNextUpdate = global.setTimeout.calls.argsFor(1)[1];
        jasmine.clock().tick(delayBeforeNextUpdate);
        updateCall();

        expect(orphanFoundCallback.calls.count()).toEqual(1);

        global.setTimeout = mockedSetTimeout;

    });
});
