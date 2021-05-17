export interface IEventEmitter {
    /**
     * Register an event handler for single invocation (subscribe)
     * @param eventType - The event type to listen to
     * @param onFunction - The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */
    one(eventType: string, onFunction: Callback, that?: any): this;

    /**
     * Register an event handler (subscribe)
     * @param eventType - The event type to listen to
     * @param onFunction - The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */

    on(eventType: string, onFunction: Callback, that?: any): this;

    /**
     * Stop listening to events (unsubscribe)
     * @param eventType - (optional) The event type to unsubscribe
     * @param onFunction - (optional) The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */
    off(
        eventType?: string | null,
        onFunction?: Callback | null,
        that?: any,
    ): this;

    /**
     * Triggers an event
     * @param eventType - The event type to trigger
     * @param args - (optional) Arguments to pass to all listeners
     */
    trigger(eventType: string, ...args: any[]): this;
}

interface Callback {
    (...args: any[]): void;
}

interface Subscriber {
    onFunction: (...args: any) => void;
    that: any;
    isOne: boolean;
}

class MicroEmitter implements IEventEmitter {
    private subscribers: Record<string, Subscriber[]> = {};

    private addSubscriber(
        eventType: string,
        onFunction: Callback,
        that: any,
        isOne: boolean,
    ) {
        if (!eventType) {
            const methodName = isOne ? 'one' : 'on';
            throw new Error(
                methodName +
                    " method requires an eventType - have you typo'd ?",
            );
        }
        if (!onFunction) {
            throw new Error('Subscribing without a function to call');
        }

        let eventSubscribers = this.subscribers[eventType];
        if (!eventSubscribers) {
            eventSubscribers = this.subscribers[eventType] = [];
        }
        eventSubscribers.push({ onFunction, that, isOne });
    }

    one(eventType: string, onFunction: Callback, that?: any) {
        this.addSubscriber(eventType, onFunction, that, true);
        return this;
    }

    on(eventType: string, onFunction: Callback, that?: any) {
        this.addSubscriber(eventType, onFunction, that, false);
        return this;
    }

    off(eventType?: string | null, onFunction?: Callback | null, that?: any) {
        if (eventType) {
            const eventSubscribers = this.subscribers[eventType];
            if (eventSubscribers) {
                for (let i = eventSubscribers.length - 1; i >= 0; i--) {
                    const subscriber = eventSubscribers[i];
                    if (
                        (!onFunction || subscriber.onFunction === onFunction) &&
                        (!subscriber.that || subscriber.that === that)
                    ) {
                        eventSubscribers.splice(i, 1);
                    }
                }
                if (eventSubscribers.length === 0) {
                    delete this.subscribers[eventType];
                }
            }
        } else {
            for (eventType in this.subscribers) {
                if (this.subscribers.hasOwnProperty(eventType)) {
                    this.off(eventType, onFunction, that);
                }
            }
        }
        return this;
    }

    trigger(eventType: string, ...args: any[]) {
        const eventSubscribers = this.subscribers[eventType];
        if (eventSubscribers) {
            for (let i = eventSubscribers.length - 1; i >= 0; i--) {
                const subscriber = eventSubscribers[i];
                if (subscriber.isOne) {
                    this.off(eventType, subscriber.onFunction, subscriber.that);
                }
                subscriber.onFunction.apply(subscriber.that, args);
            }
        }
        return this;
    }
}

export default MicroEmitter;
