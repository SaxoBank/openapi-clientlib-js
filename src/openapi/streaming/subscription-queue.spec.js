import SubscriptionQueue from './subscription-queue';
import * as SubscriptionActions from './subscription-actions';

describe('openapi SubscriptionQueue', () => {
    let queue;

    describe('enqueue', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('throws if no action', () => {
            expect(() => {
                queue.enqueue({});
            }).toThrow();
        });

        it('should add one action', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(false);
        });
    });

    describe('enqueue & dequeue', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        const tests = [
            [
                'should merge same actions - subscribe',
                [
                    SubscriptionActions.ACTION_SUBSCRIBE,
                    SubscriptionActions.ACTION_SUBSCRIBE,
                ],
                [SubscriptionActions.ACTION_SUBSCRIBE],
            ],
        ];

        tests.forEach(([title, actionsToQueue, expectedActions]) => {
            it(title, () => {});
        });

        it('should merge same actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop subscribe when surpassed by unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop unsubscribe when surpassed by subscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('two modifies in a row should result in one modify', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop subscribe when subscribing after a modify', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should keep unsubscribe force followed by subscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop a unsubscribe if followed by a subscribe, even if there are lots of modify patch', () => {
            // we don't know the current state being subscribe/unsubscribe so we don't know in the queue if we need the modify patches
            // we also don't know if the args overlap each other, so we don't eliminate them (we could)
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should clear patches if doing a subscribe and calling clearPatches', () => {
            // See above but in this case we call clear Patches when subscribing
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            queue.clearPatches();
            expect(queue.isEmpty()).toBe(true);
        });

        it('should clear patches if doing a unsubscribe even if we have a modify on a unsubscribe', () => {
            // See above but in this case we add a modify patch after the unsubscribe
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should clear patches if doing a unsubscribe even if we have a modify on a unsubscribe 2', () => {
            // See above but in this case we add a modify patch after the unsubscribe
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            queue.clearPatches();
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop all actions except unsubscribe force followed by subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop all actions followed by unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop subscribe followed by unsubscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one unsubscribe with neither force', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one unsubscribe with first force', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue()).toStrictEqual({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one unsubscribe with second force', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });

            expect(queue.dequeue()).toStrictEqual({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one unsubscribe with both force', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });

            expect(queue.dequeue()).toStrictEqual({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave subscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should not merge patch actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_MODIFY_PATCH,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before unsubscribe followed by modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove unsubscribe if action is unsubscribe by tag', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            });
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove force unsubscribe if action is unsubscribe by tag', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            });
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should dequeue first and only action and leave queue empty', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should return undefined for dequeue on empty queue', () => {
            expect(queue.dequeue()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before last unsubscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before last unsubscribe by tag', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            );
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions after modify subscribe', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });

            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            queue.clearPatches();
            expect(queue.isEmpty()).toBe(true);
        });
    });

    describe('peek', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should return first and only item', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return first item from two available', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return undefined for empty queue', () => {
            expect(queue.peekAction()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should return two consecutive actions after two dequeues', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            });
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );

            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.dequeue().action).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );

            expect(queue.peekAction()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });
    });

    describe('isEmpty', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should return true for empty queue without any enqueue invocation', () => {
            expect(queue.isEmpty()).toBe(true);
        });

        it('should return false queue with one item', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return false queue with two items', () => {
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.isEmpty()).toBe(false);
        });

        it('should return false queue with two merged items', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            });

            expect(queue.isEmpty()).toBe(false);
        });

        it('should return false queue with two merged duplicate items', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.isEmpty()).toBe(false);
        });
    });

    describe('reset', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should empty queue with one existing actions', () => {
            queue.enqueue({ action: 1 });
            queue.reset();
            expect(queue.isEmpty()).toBe(true);
        });

        it('should empty queue with multiple available actions', () => {
            queue.enqueue({ action: 1 });
            queue.enqueue({ action: 2 });
            queue.reset();
            expect(queue.isEmpty()).toBe(true);
        });
    });
});
