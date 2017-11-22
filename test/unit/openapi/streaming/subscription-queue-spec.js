const SubscriptionQueue = saxo.openapi._StreamingSubscriptionQueue;
const SubscriptionActions = saxo.openapi._StreamingSubscriptionActions;

describe('openapi SubscriptionQueue', () => {
    let queue;

    describe('enqueue', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should add one action', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        });

        it('should add two different actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        });

        it('should merge same actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop subscribe when surpassed by unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop unsubscribe when surpassed by subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should clamp to default max queue size', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop subscribe when previous actions is modify', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should keep unsubscribe followed by modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop all actions except unsubscribe followed by modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop all actions followed by unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should drop modify subscribe followed by unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one unsubscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave one modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should merge and only leave subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should not merge patch actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_PATCH);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_PATCH);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should not insert subscribe after modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before unsubscribe followed by modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove unsubscribe if action is unsubscribe by tag', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING });
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING);
            expect(queue.isEmpty()).toBe(true);
        });
    });

    describe('dequeue', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should dequeue first and only action and leave queue empty', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should dequeue one from two available actions', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        });

        it('should dequeue all actions and leave queue empty', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should return undefined for dequeue on empty queue', () => {
            expect(queue.dequeue()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before last unsubscribe', () => {

            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions before last unsubscribe by tag', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should remove all actions after modify subscribe', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_PATCH });

            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        });
    });

    describe('peek', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        });

        it('should return first and only item', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return first item from two available', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return undefined for empty queue', () => {
            expect(queue.peekAction()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        });

        it('should return two consecutive actions after two dequeues', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_MODIFY_SUBSCRIBE });

            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.peekAction()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.dequeue().action).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

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
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            expect(queue.isEmpty()).toBe(false);
        });

        it('should return false queue with two items', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });

            expect(queue.isEmpty()).toBe(false);
        });

        it('should return false queue with two merged items', () => {
            queue.enqueue({ action: SubscriptionActions.ACTION_SUBSCRIBE });
            queue.enqueue({ action: SubscriptionActions.ACTION_UNSUBSCRIBE });

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
