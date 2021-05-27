/**
 * Schedules a micro-task to run after breaking the current call stack
 * - See {@link https://github.com/kriskowal/asap} and {@link https://github.com/YuzuJS/setImmediate}.
 * @param func - The function to run after code has been broken out of.
 */
let nextTick: (func: () => void) => void; // eslint-disable-line import/no-mutable-exports

// Borrowed from Q JS lib
// https://github.com/kriskowal/q/blob/v1/q.js#L169
// use the fastest possible means to execute a task in a future turn
// of the event loop.
if (typeof setImmediate === 'function') {
    // https://github.com/NobleJS/setImmediate
    nextTick = function (func: () => void) {
        // IE11 throws "invalid calling object" if re-assigned, so we have to wrap
        setImmediate(func);
    };
} else if (typeof MessageChannel !== 'undefined') {
    // modern browsers
    // http://www.nonblocking.io/2011/06/windownexttick.html
    const channel = new MessageChannel();
    // linked list of tasks (single, with head node)
    let head: Record<string, any> = {};
    let tail = head;
    channel.port1.onmessage = function () {
        head = head.next;
        const task = head.task;
        delete head.task;
        task();
    };
    nextTick = function (task: () => void) {
        tail = tail.next = { task };
        channel.port2.postMessage(0);
    };
} else {
    // default to the "old browsers" implementation
    // 2nd argument optional http://stackoverflow.com/questions/2723610/settimeoutfun-with-a-single-argument-timeout-not-specified
    nextTick = setTimeout;
}

// -- Export section --

export { nextTick };
