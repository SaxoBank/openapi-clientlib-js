/* globals ES6Promise */
/* the promise polyfill requires running before it polyfills...*/
ES6Promise.polyfill();

/*
 *  There are 2 problems with using jasmine fake-clock
 *  1. Promise is always async, so it uses setTimeout, which is faked by jasmine
 *  2. In an environment where Promise is native, it doesn't use setTimeout
 *  So, when testing promises, we need to first do a fake-clock tick
 *  to fire the results of promises when Promise *is not* in the browser,
 *  then run our code in a setTimeout for when Promise *is* in the browser
 */
const realSetTimeout = setTimeout;
function tick(func) {
    jasmine.clock().tick(1); // for phantomjs
    realSetTimeout(func, 1); // for when running in a modern browser (that doesn't fallback to nextTick=setTimeout)
}

/**
 * Recurrent loop which asynchronously one after another, invokes list of methods wrapped with tick.
 * @param {function} cursor - The function which will be invoked inside tick wrapper.
 * @param {array} list - The array of methods to be invoked asynchronously through tick wrapper one after another.
 */
function tickRecurrentLoop(cursor, list) {
    if (!cursor) {
        return;
    }

    tick(() => {
        cursor();
        tickRecurrentLoop(list.shift(), list);
    });
}

/**
 * Invoke list of methods as async ticks (one after another).
 * Useful alternative to nested callback hell.
 * @param {array} list - The array of actions which will be invoked as a ticks, one after another (async).
 * @param {boolean} startImmediately - The flag which causes first method to be invoked without tick wrapper.
 */
function tickArray(list, startImmediately = false) {
    if (!list || list.length === 0) {
        return;
    }

    if (startImmediately) {
        list.shift()();
    }

    tickRecurrentLoop(list.shift(), list);
}

// eslint-disable-next-line no-eval
const global = (0, eval)('this');

const mockDate = new Date(2015, 3, 27);

function multiline() {
    const lines = Array.prototype.slice.call(arguments);
    return lines.join('\r\n');
}

function installClock() {
    jasmine.clock().install();
    jasmine.clock().mockDate(mockDate);
}
function uninstallClock() {
    jasmine.clock().tick(1);
    jasmine.clock().uninstall();
}

export {
    tick,
    tickArray,
    global,
    multiline,
    installClock,
    uninstallClock,
    mockDate,
};
