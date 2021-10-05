import { installClock, uninstallClock, tick } from '../../test/utils';
import StreamingOrphanFinder, {
    DEFAULT_START_DELAY,
    INACTIVITY_LENIENCY,
} from './orphan-finder';
import type Subscription from './subscription';

describe('openapi StreamingOrphanFinder', () => {
    let streamingOrphanFinder: StreamingOrphanFinder;
    let orphanFoundCallback: jest.Mock;
    let orphanedSubscription: any;
    let notOrphanedSubscription: any;
    let orphanIn20Subscription: any;
    let orphanIn30Subscription: any;
    let orphanedSubscriptionTime;
    let notOrphanedSubscriptionTime;
    let transitioningSubscriptionTime;
    let orphanIn20SubscriptionTime: { time: number };
    let orphanIn30SubscriptionTime: { time: number };

    function mockSubscription(timeTillOrphanedObj: { time: number }) {
        const subscription = {
            timeTillOrphaned: jest.fn(),
        };
        subscription.timeTillOrphaned.mockImplementation(
            () => timeTillOrphanedObj.time,
        );
        return subscription;
    }

    beforeEach(() => {
        orphanedSubscriptionTime = { time: -(1 + INACTIVITY_LENIENCY) };
        orphanedSubscription = mockSubscription(orphanedSubscriptionTime);

        notOrphanedSubscriptionTime = { time: -INACTIVITY_LENIENCY + 1 };
        notOrphanedSubscription = mockSubscription(notOrphanedSubscriptionTime);

        transitioningSubscriptionTime = { time: Infinity };
        mockSubscription(transitioningSubscriptionTime);

        orphanIn20SubscriptionTime = { time: 20000 - INACTIVITY_LENIENCY };
        orphanIn20Subscription = mockSubscription(orphanIn20SubscriptionTime);

        orphanIn30SubscriptionTime = { time: 30000 - INACTIVITY_LENIENCY };
        orphanIn30Subscription = mockSubscription(orphanIn30SubscriptionTime);

        orphanFoundCallback = jest.fn().mockName('orphanFound');

        installClock();
    });
    afterEach(() => uninstallClock());

    it('requires subscriptions and callback', () => {
        expect(function () {
            new StreamingOrphanFinder([], function () {});
        }).not.toThrow();
        expect(function () {
            // @ts-expect-error checking invalid case
            new StreamingOrphanFinder(null, function () {});
        }).toThrow();
        expect(function () {
            // @ts-expect-error checking invalid case
            new StreamingOrphanFinder([]);
        }).toThrow();
    });

    it('does not do anything when constructed or updated with an empty list', () => {
        streamingOrphanFinder = new StreamingOrphanFinder(
            [],
            orphanFoundCallback,
        );
        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();

        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
    });

    it('resets orphaned subscriptions', () => {
        const subscriptions: Subscription[] = [];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        streamingOrphanFinder.start();
        tick(DEFAULT_START_DELAY);

        subscriptions.push(orphanedSubscription);
        streamingOrphanFinder.update();

        expect(orphanFoundCallback.mock.calls.length).toEqual(1);
        expect(orphanFoundCallback.mock.calls[0]).toEqual([
            orphanedSubscription,
        ]);
    });

    it('reschedules its update if a sooner update comes in', () => {
        const subscriptions = [orphanIn30Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 30000,
        );

        tick(10000);
        orphanIn30SubscriptionTime.time = 20000 - INACTIVITY_LENIENCY;
        orphanIn20SubscriptionTime.time = 10000 - INACTIVITY_LENIENCY;

        subscriptions.push(orphanIn20Subscription);
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 10000,
        );
    });

    it('does not reschedule if the time is unchanged', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 20000,
        );

        tick(10000);
        orphanIn30SubscriptionTime.time = 20000 - INACTIVITY_LENIENCY;
        orphanIn20SubscriptionTime.time = 10000 - INACTIVITY_LENIENCY;

        subscriptions.push(orphanIn30Subscription);
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 10000,
        );
    });

    it('removes timer if no subscriptions have a time till orphaned 1', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 20000,
        );

        orphanIn20SubscriptionTime.time = -INACTIVITY_LENIENCY;
        tick(20000);

        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();

        expect(orphanFoundCallback.mock.calls.length).toEqual(1);
        expect(orphanFoundCallback.mock.calls[0]).toEqual([
            orphanIn20Subscription,
        ]);
    });

    it('removes timer when you call dispose', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        streamingOrphanFinder.start();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeTruthy();
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 20000,
        );

        streamingOrphanFinder.stop();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
    });

    it('has a start delay that waits before reporting orphans', () => {
        const subscriptions = [orphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );
        streamingOrphanFinder.start();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + DEFAULT_START_DELAY,
        );

        tick(DEFAULT_START_DELAY / 2);

        streamingOrphanFinder.update();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + DEFAULT_START_DELAY / 2,
        );

        tick(DEFAULT_START_DELAY / 2);

        expect(orphanFoundCallback.mock.calls.length).toEqual(1);
        expect(orphanFoundCallback.mock.calls[0]).toEqual([
            orphanedSubscription,
        ]);
    });

    it('has a start delay that waits until up before checking', () => {
        const subscriptions = [notOrphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );
        streamingOrphanFinder.start();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + DEFAULT_START_DELAY,
        );

        tick(DEFAULT_START_DELAY / 2);

        streamingOrphanFinder.update();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + DEFAULT_START_DELAY / 2,
        );

        tick(DEFAULT_START_DELAY / 2);

        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(Date.now() + 1);
    });

    it('does not do anything when updated when stopped', () => {
        const subscriptions = [orphanedSubscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );
        streamingOrphanFinder.update();
        expect(streamingOrphanFinder.nextUpdateTimeoutId).toBeFalsy();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
    });

    it('delays tests if the update has been called very late', () => {
        const subscriptions = [orphanIn20Subscription];
        streamingOrphanFinder = new StreamingOrphanFinder(
            subscriptions,
            orphanFoundCallback,
        );

        const mockedSetTimeout = window.setTimeout;

        const spySetTimeout =
            // @ts-ignore
            (window.setTimeout = jest.fn().mockName('setTimeout')); // hide timeout calls from happening

        streamingOrphanFinder.start();
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);
        expect(streamingOrphanFinder.nextUpdateTime).toEqual(
            Date.now() + 20000,
        );
        // @ts-ignore
        expect(global.setTimeout.mock.calls.length).toEqual(1); // start scheduled one update

        // restore fake setTimeout
        global.setTimeout = mockedSetTimeout;
        tick(30 * 60 * 1000); // now go forward 30 minutes
        // @ts-ignore
        global.setTimeout = spySetTimeout;

        orphanIn20SubscriptionTime.time = -(100000 + INACTIVITY_LENIENCY); // make our subscription orphaned
        expect(orphanFoundCallback.mock.calls.length).toEqual(0);

        // @ts-ignore
        let updateCall = global.setTimeout.mock.calls[0][0];
        updateCall(); // we schedule the timer, happening late, it should detect it and not report orphaned, in case a phone went to sleep and was just awoken

        expect(orphanFoundCallback.mock.calls.length).toEqual(0); // so it has not reported it
        // @ts-ignore
        expect(global.setTimeout.mock.calls.length).toEqual(2); // but it has scheduled a new update

        // @ts-ignore
        updateCall = global.setTimeout.mock.calls[1][0];

        // @ts-ignore
        const delayBeforeNextUpdate = global.setTimeout.mock.calls[1][1];

        // restore fake setTimeout
        global.setTimeout = mockedSetTimeout;
        tick(delayBeforeNextUpdate);

        updateCall();

        expect(orphanFoundCallback.mock.calls.length).toEqual(1);
    });
});
