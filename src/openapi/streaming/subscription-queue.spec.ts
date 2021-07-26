import SubscriptionQueue from './subscription-queue';
import * as SubscriptionActions from './subscription-actions';

describe('openapi SubscriptionQueue', () => {
    let queue: SubscriptionQueue;

    describe('enqueue', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('throws if no action', () => {
            expect(() => {
                // @ts-expect-error checking invalid usage
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

        it('should return undefined for dequeue on empty queue', () => {
            expect(queue.isEmpty()).toBe(true);
            expect(queue.dequeue()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });

        function subscribe() {
            return { action: SubscriptionActions.ACTION_SUBSCRIBE };
        }

        function unsubscribe() {
            return {
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: false },
            };
        }

        function forceUnsubscribe() {
            return {
                action: SubscriptionActions.ACTION_UNSUBSCRIBE,
                args: { force: true },
            };
        }

        function modifyPatch() {
            return { action: SubscriptionActions.ACTION_MODIFY_PATCH };
        }

        function modifyReplace() {
            return { action: SubscriptionActions.ACTION_MODIFY_REPLACE };
        }

        function unsubscribeByTagPending() {
            return {
                action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            };
        }

        it.each([
            // Basic tests
            [
                'should dequeue first and only action and leave queue empty',
                [subscribe()],
                [subscribe()],
            ],
            // Subscribe <> Unsubscribe
            [
                'should merge same actions - subscribe',
                [subscribe(), subscribe()],
                [subscribe()],
            ],
            [
                'should drop subscribe when surpassed by unsubscribe',
                [subscribe(), unsubscribe()],
                [unsubscribe()],
            ],
            [
                'should merge and only leave unsubscribe',
                [subscribe(), unsubscribe(), subscribe(), unsubscribe()],
                [unsubscribe()],
            ],
            [
                'should drop unsubscribe when surpassed by subscribe',
                [unsubscribe(), subscribe()],
                [subscribe()],
            ],
            [
                'should merge and only leave subscribe',
                [unsubscribe(), subscribe(), unsubscribe(), subscribe()],
                [subscribe()],
            ],
            [
                'should remove all actions before last unsubscribe',
                [forceUnsubscribe(), subscribe(), subscribe(), unsubscribe()],
                [forceUnsubscribe()],
            ],

            // Multiple Unsubscribes
            [
                'should merge and only leave one unsubscribe with first force',
                [forceUnsubscribe(), unsubscribe()],
                [forceUnsubscribe()],
            ],
            [
                'should merge and only leave one unsubscribe with second force',
                [unsubscribe(), forceUnsubscribe()],
                [forceUnsubscribe()],
            ],
            [
                'should merge and only leave one unsubscribe with both force',
                [forceUnsubscribe(), forceUnsubscribe()],
                [forceUnsubscribe()],
            ],
            [
                'should merge and only leave one unsubscribe with neither force',
                [unsubscribe(), unsubscribe()],
                [unsubscribe()],
            ],

            // Force unsubscribe (modify/reset)
            [
                'two modifies in a row should result in one modify',
                [
                    forceUnsubscribe(),
                    subscribe(),
                    forceUnsubscribe(),
                    subscribe(),
                ],
                [forceUnsubscribe(), subscribe()],
            ],
            [
                'should drop subscribe when subscribing after a modify',
                [forceUnsubscribe(), subscribe(), subscribe()],
                [forceUnsubscribe(), subscribe()],
            ],
            [
                'should keep unsubscribe force followed by subscribe',
                [forceUnsubscribe(), subscribe()],
                [forceUnsubscribe(), subscribe()],
            ],

            // modify patch
            [
                'should drop a unsubscribe if followed by a subscribe, even if there are lots of modify patch',
                // we don't know the current state being subscribe/unsubscribe so we don't know in the queue if we need the modify patches
                // we also don't know if the args overlap each other, so we don't eliminate them (we could)
                [
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    unsubscribe(),
                    subscribe(),
                ],
                [
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    subscribe(),
                ],
            ],
            [
                'should clear patches if doing a subscribe and calling clearModifys',
                [
                    // See above but in this case we call clear Patches when subscribing
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    unsubscribe(),
                    subscribe(),
                ],
                [subscribe(), 'clearModifys'],
            ],
            [
                'should clear patches if doing a unsubscribe even if we have a modify on a unsubscribe',
                [
                    // See above but in this case we add a modify patch after the unsubscribe
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    unsubscribe(),
                    modifyPatch(),
                    subscribe(),
                    modifyPatch(),
                    unsubscribe(),
                ],
                [unsubscribe()],
            ],
            [
                'should clear patches if doing a unsubscribe even if we have a modify on a unsubscribe 2',
                [
                    // See above but in this case we add a modify patch after the unsubscribe
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    unsubscribe(),
                    modifyPatch(),
                    subscribe(),
                    modifyPatch(),
                ],
                [unsubscribe(), modifyPatch(), subscribe(), 'clearModifys'],
            ],
            [
                'should drop all actions except unsubscribe force followed by subscribe',
                [
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    forceUnsubscribe(),
                    subscribe(),
                ],
                [forceUnsubscribe(), subscribe()],
            ],
            [
                'should drop all actions followed by unsubscribe',
                [
                    subscribe(),
                    modifyPatch(),
                    modifyPatch(),
                    modifyPatch(),
                    unsubscribe(),
                ],
                [unsubscribe()],
            ],
            [
                'should not merge patch actions',
                [modifyPatch(), modifyPatch()],
                [modifyPatch(), modifyPatch()],
            ],
            [
                'should remove all actions before unsubscribe followed by modify subscribe',
                [modifyPatch(), modifyPatch(), forceUnsubscribe(), subscribe()],
                [forceUnsubscribe(), subscribe()],
            ],
            [
                'should remove all actions after modify subscribe',
                [
                    forceUnsubscribe(),
                    subscribe(),
                    unsubscribe(),
                    subscribe(),
                    modifyPatch(),
                ],
                [forceUnsubscribe(), subscribe(), 'clearModifys'],
            ],

            // modify-replace
            [
                'should discard the earlier of a consecutive pair of modify-replace actions',
                // unlike with patch, here we send all the arguments, so can do this
                [modifyReplace(), modifyReplace()],
                [modifyReplace()],
            ],

            // tag tests
            [
                'should remove unsubscribe if action is unsubscribe by tag',
                [unsubscribe(), unsubscribeByTagPending()],
                [unsubscribeByTagPending()],
            ],
            [
                'should remove force unsubscribe if action is unsubscribe by tag',
                [forceUnsubscribe(), unsubscribeByTagPending()],
                [unsubscribeByTagPending()],
            ],
            [
                'should remove all actions before last unsubscribe by tag',
                [
                    forceUnsubscribe(),
                    subscribe(),
                    subscribe(),
                    unsubscribeByTagPending(),
                ],
                [unsubscribeByTagPending()],
            ],
        ])('%s', (_, actionsToQueue, expectedActions) => {
            for (const action of actionsToQueue) {
                queue.enqueue(action);
            }
            for (const action of expectedActions) {
                if (action === 'clearModifys') {
                    queue.clearModifys();
                } else {
                    expect(queue.dequeue()).toStrictEqual(action);
                }
            }
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
            expect(queue.dequeue()?.action).toBe(
                SubscriptionActions.ACTION_UNSUBSCRIBE,
            );

            expect(queue.peekAction()).toBe(
                SubscriptionActions.ACTION_SUBSCRIBE,
            );
            expect(queue.dequeue()?.action).toBe(
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
            queue.enqueue({
                action: SubscriptionActions.ACTION_SUBSCRIBE,
                args: undefined,
            });

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
