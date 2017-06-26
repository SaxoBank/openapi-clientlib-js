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

export { tick, global, multiline, installClock, uninstallClock, mockDate };
