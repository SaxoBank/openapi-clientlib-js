/**
 * @module saxo/micro-emitter
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * This set of functions can be mixed into any class or object.
 * @see saxo.microEmitter.mixinTo
 * @mixin MicroEmitter
 * @global
 */

/**
 * Register an event handler for single invocation (subscribe)
 * @method MicroEmitter#one
 * @param {string} eventType - The event type to listen to
 * @param {function} onFunction - The function to call
 * @param [that] - The context with which to call onFunction (useful also for unsubscribing only a instance)
 */

/**
 * Register an event handler (subscribe)
 * @method MicroEmitter#on
 * @param {string} eventType - The event type to listen to
 * @param {function} onFunction - The function to call
 * @param [that] - The context with which to call onFunction (useful also for unsubscribing only a instance)
 */

/**
 * Stop listening to events (unsubscribe)
 * @method MicroEmitter#off
 * @param {string} [eventType] - The event type to unsubscribe
 * @param {function} [onFunction] - The function to call
 * @param [that] - The context with which to call onFunction (useful also for unsubscribing only a instance)
 */

/**
 * Triggers an event
 * @method MicroEmitter#trigger
 * @param {string} eventType - The event type to trigger
 * @param {...*} [arg] - Arguments to pass to all listeners
 */

/**
 * This provides a method to mix an emitter into an object.
 * @namespace saxo.microEmitter
 */

/**
 * mixes the {@link MicroEmitter} into the target
 * @function
 * @alias saxo.microEmitter.mixinTo
 * @param {object} target - The object to mix values into
 * @example
 * // mix into a static object
 * var myObj = {};
 * saxo.microEmitter.mixinTo(myObj);
 * myObj.on("event", function() { console.log("received event"); });
 * myObj.trigger("event");
 *
 * // mix into a function prototype
 * var myClass = function() {};
 * saxo.microEmitter.mixinTo(myClass.prototype);
 * var myInstance = new myClass();
 * myInstance.on("event", function() { console.log("received event"); });
 * myInstance.trigger("event");
 */
function mixinEmitter(target) {
    const subscribers = {};

    if (target.on || target.off || target.trigger) {
        throw new Error('Mixing in would hide existing implementations of on/off/trigger');
    }

    function addSubscriber(eventType, onFunction, that, isOne) {
        if (!eventType) {
            const methodName = isOne ? 'one' : 'on';
            throw new Error(methodName + ' method requires an eventType - have you typo\'d ?');
        }
        if (!onFunction) {
            throw new Error('Subscribing without a function to call');
        }
        let eventSubscribers = subscribers[eventType];
        if (!eventSubscribers) {
            eventSubscribers = subscribers[eventType] = [];
        }
        eventSubscribers.push({ onFunction, that, isOne });
    }

    target.one = function(eventType, onFunction, that) {
        addSubscriber(eventType, onFunction, that, true);
        return this;
    };

    target.on = function(eventType, onFunction, that) {
        addSubscriber(eventType, onFunction, that, false);
        return this;
    };

    target.off = function(eventType, onFunction, that) {
        if (eventType) {
            const eventSubscribers = subscribers[eventType];
            if (eventSubscribers) {
                for (let i = eventSubscribers.length - 1; i >= 0; i--) {
                    const subscriber = eventSubscribers[i];
                    if ((!onFunction || subscriber.onFunction === onFunction) &&
                        (!subscriber.that || subscriber.that === that)) {
                        eventSubscribers.splice(i, 1);
                    }
                }
                if (eventSubscribers.length === 0) {
                    delete subscribers[eventType];
                }
            }
        } else {
            for (eventType in subscribers) {
                if (subscribers.hasOwnProperty(eventType)) {
                    target.off(eventType, onFunction, that);
                }
            }
        }
        return this;
    };

    target.trigger = function(eventType) {
        const eventSubscribers = subscribers[eventType];
        if (eventSubscribers) {
            const args = Array.prototype.slice.call(arguments, 1);
            for (let i = eventSubscribers.length - 1; i >= 0; i--) {
                const subscriber = eventSubscribers[i];
                if (subscriber.isOne) {
                    target.off(eventType, subscriber.onFunction, subscriber.that);
                }
                subscriber.onFunction.apply(subscriber.that, args);
            }
        }
        return this;
    };
}

// -- Export section --

export default { mixinTo: mixinEmitter };
