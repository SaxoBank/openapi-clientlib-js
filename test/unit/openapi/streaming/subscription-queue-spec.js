
const SubscriptionQueue = saxo.openapi._StreamingSubscriptionQueue;
const SubscriptionActions = saxo.openapi._StreamingSubscriptionActions;

describe("openapi SubscriptionQueue", () => {
    let queue;

    describe("enqueue", () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        })

        it('should add one action', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.peek()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should add two different actions', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.peek()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should merge same actions', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should drop subscribe when surpassed by unsubscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should drop unsubscribe when surpassed by subscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should clamp to default max queue size', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should drop subscribe when previous actions is modify', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should drop subscribe followed by modify subscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should keep unsubscribe followed by modify subscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should drop modify subscribe followed by unsubscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should merge and only leave unsubscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should merge and only leave subscribe', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })
    });

    describe("dequeue", () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        })

        it('should dequeue first and only action and leave queue empty', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should dequeue one from two available actions', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.peek()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should dequeue all actions and leave queue empty', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should return undefined for dequeue on empty queue', () => {
            expect(queue.dequeue()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        })
    });

    describe("peek", () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        })

        it('should return first and only item', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.peek()).toBe(SubscriptionActions.ACTION_SUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should return first item from two available', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.peek()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should return undefined for empty queue', () => {
            expect(queue.peek()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should return two consecutive actions after two dequeues', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.peek()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.peek()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);
            expect(queue.dequeue()).toBe(SubscriptionActions.ACTION_MODIFY_SUBSCRIBE);

            expect(queue.peek()).toBe(undefined);
            expect(queue.isEmpty()).toBe(true);
        })
    });

    describe('isEmpty', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        })

        it('should return true for empty queue without any enqueue invocation', () => {
            expect(queue.isEmpty()).toBe(true);
        })

        it('should return false queue with one item', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            expect(queue.isEmpty()).toBe(false);
        })

        it('should return false queue with two items', () => {
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.isEmpty()).toBe(false);
        })

        it('should return false queue with two merged items', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_UNSUBSCRIBE);

            expect(queue.isEmpty()).toBe(false);
        })

        it('should return false queue with two merged duplicate items', () => {
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);
            queue.enqueue(SubscriptionActions.ACTION_SUBSCRIBE);

            expect(queue.isEmpty()).toBe(false);
        })
    })

    describe('reset', () => {
        beforeEach(() => {
            queue = new SubscriptionQueue();
        })

        it('should empty queue with one existing actions', () => {
            queue.enqueue(1);
            queue.reset();
            expect(queue.isEmpty()).toBe(true);
        })

        it('should empty queue with multiple available actions', () => {
            queue.enqueue(1);
            queue.enqueue(2);
            queue.reset();
            expect(queue.isEmpty()).toBe(true);
        })
    })

    describe('maxSize', () => {
        it('should use default max size of 2', () => {
            queue = new SubscriptionQueue();
            queue.enqueue(1);
            queue.enqueue(2);
            queue.enqueue(3);
            queue.enqueue(4);

            expect(queue.dequeue()).toBe(3);
            expect(queue.dequeue()).toBe(4);
            expect(queue.isEmpty()).toBe(true);
        })

        it('should use default specified maxSize of 6', () => {
            queue = new SubscriptionQueue(6);
            queue.enqueue(1);
            queue.enqueue(2);
            queue.enqueue(3);
            queue.enqueue(4);
            queue.enqueue(5);
            queue.enqueue(6);
            queue.enqueue(7);
            queue.enqueue(8);

            expect(queue.dequeue()).toBe(3);
            expect(queue.dequeue()).toBe(4);
            expect(queue.dequeue()).toBe(5);
            expect(queue.dequeue()).toBe(6);
            expect(queue.dequeue()).toBe(7);
            expect(queue.dequeue()).toBe(8);
            expect(queue.isEmpty()).toBe(true);
        })
    })
});
