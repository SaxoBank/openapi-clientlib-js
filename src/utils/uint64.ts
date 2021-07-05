/**
 * Converts typed array (Uint8Array) storing 64bit unsigned integer to a number.
 * It is not useful once the number gets large, but it is ok for e.g. message id's
 * @param typedArray - typedArray
 */
export function uint64ToNumber(typedArray: Uint8Array) {
    let value = 0;
    // Running sum of octets, doing a 2's complement
    for (let i = 7, multiplier = 1; i >= 0; i--, multiplier *= 256) {
        value += typedArray[i] * multiplier;
    }
    return value;
}
