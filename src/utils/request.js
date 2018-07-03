// counter used for identifying unique request and it will share among all transports
let requestCounter = 0;

function resetCounter() {
    requestCounter = 0;
}

function getRequestId() {
    return ++requestCounter;
}

function globalToLocalRequestId(globalRequestId, parentRequestId) {
    return Math.max(parentRequestId - globalRequestId - 1, 0);
}

export { getRequestId, globalToLocalRequestId, resetCounter };
