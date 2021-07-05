/**
 * Converts typed array (Uint8Array) storing 64bit unsigned integer to a number.
 * It is not useful once the number gets large, but it is ok for e.g. message id's
 * @param typedArray - typedArray
 */
export function uint64ToNumber(typedArray: Uint8Array) {
    let value = 0;
    for (let i = 0, multiplier = 1; i <= 7; i++, multiplier *= 256) {
        value += typedArray[i] * multiplier;
    }
    return value;
}
