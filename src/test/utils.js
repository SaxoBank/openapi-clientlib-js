import mockDate from 'mockdate';

function multiline() {
    const lines = Array.prototype.slice.call(arguments);
    return lines.join('\r\n');
}

let clock = false;
function installClock() {
    jest.useFakeTimers();
    mockDate.set(new Date(2015, 3, 27));
    clock = true;
}

function tick(n) {
    mockDate.set(new Date(Date.now() + n));
    jest.advanceTimersByTime(n);
}

function uninstallClock() {
    if (!clock) {
        throw new Error('no clock');
    }
    clock = false;
    jest.clearAllTimers();
}

const unMockedSetTimeout = global.setTimeout;
const setTimeout = (fn) => unMockedSetTimeout(fn, 0);

export const waterfallTimeout = (arr, startIndex) => {
    unMockedSetTimeout(() => {
        startIndex = startIndex || 0;
        arr[startIndex]();
        if (arr.length > startIndex + 1) {
            waterfallTimeout(arr, startIndex + 1);
        }
    }, 0);
};

export { tick, setTimeout, multiline, installClock, uninstallClock, mockDate };
