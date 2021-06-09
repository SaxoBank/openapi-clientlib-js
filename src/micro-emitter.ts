export type EventTypes = Record<string, Callback>;

export interface IEventEmitter<
    Events extends EventTypes,
    ChainedType = IEventEmitter<any, any>,
> {
    /**
     * Register an event handler for single invocation (subscribe)
     * @param eventType - The event type to listen to
     * @param onFunction - The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */
    one<Event extends keyof Events>(
        eventType: Event,
        onFunction: Events[Event],
        that?: any,
    ): ChainedType extends IEventEmitter<any> ? this : ChainedType;

    /**
     * Register an event handler (subscribe)
     * @param eventType - The event type to listen to
     * @param onFunction - The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */
    on<Event extends keyof Events>(
        eventType: Event,
        onFunction: Events[Event],
        that?: any,
    ): ChainedType extends IEventEmitter<any> ? this : ChainedType;

    /**
     * Stop listening to events (unsubscribe)
     * @param eventType - (optional) The event type to unsubscribe
     * @param onFunction - (optional) The function to call
     * @param that - (optional) The context with which to call onFunction (useful also for unsubscribing only a instance)
     */
    off<Event extends keyof Events>(
        eventType?: Event | null,
        onFunction?: Events[Event] | null,
        that?: any,
    ): ChainedType extends IEventEmitter<any> ? this : ChainedType;

    /**
     * Triggers an event
     * @param eventType - The event type to trigger
     * @param args - (optional) Arguments to pass to all listeners
     */
    trigger<Event extends keyof Events>(
        eventType: Event,
        ...args: Parameters<Events[Event]>
    ): ChainedType extends IEventEmitter<any> ? this : ChainedType;
}

export interface Callback {
    (...args: any[]): void;
}

interface Subscriber<C = Callback> {
    onFunction: C;
    that: any;
    isOne: boolean;
}

class MicroEmitter<Events extends EventTypes> implements IEventEmitter<Events> {
    private subscribers: Partial<Record<keyof Events, Subscriber[]>> = {};

    private addSubscriber<Event extends keyof Events>(
        eventType: Event,
        onFunction: Events[Event],
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

    one<Event extends keyof Events>(
        eventType: Event,
        onFunction: Events[Event],
        that?: any,
    ) {
        this.addSubscriber(eventType, onFunction, that, true);
        return this;
    }

    on<Event extends keyof Events>(
        eventType: Event,
        onFunction: Events[Event],
        that?: any,
    ) {
        this.addSubscriber(eventType, onFunction, that, false);
        return this;
    }

    off<Event extends keyof Events>(
        eventType?: Event | null,
        onFunction?: Events[Event] | null,
        that?: any,
    ) {
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
            for (const subscriberEventType in this.subscribers) {
                if (this.subscribers.hasOwnProperty(subscriberEventType)) {
                    // @ts-expect-error
                    this.off(subscriberEventType, onFunction, that);
                }
            }
        }
        return this;
    }

    trigger<Event extends keyof Events>(
        eventType: Event,
        ...args: Parameters<Events[Event]>
    ) {
        const eventSubscribers = this.subscribers[eventType];
        if (eventSubscribers) {
            for (let i = eventSubscribers.length - 1; i >= 0; i--) {
                const subscriber = eventSubscribers[i] as Subscriber<
                    Events[Event]
                >;

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
