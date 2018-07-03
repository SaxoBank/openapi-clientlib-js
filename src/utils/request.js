// counter used for identifying unique request and it will share among all transports
let requestCounter = 0;

function resetCounter() {
    requestCounter = 0;
}

function getRequestId() {
    return ++requestCounter;
}

function globalToLocalRequestId(globalRequestId, parentRequestId) {
    return Math.max(globalRequestId - parentRequestId - 1, 0);
}

export { getRequestId, globalToLocalRequestId, resetCounter };
