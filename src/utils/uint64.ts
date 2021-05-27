const H = 0x100000000;
const D = 1000000000;

/**
 * Converts typed array (Uint8Array) storing 64bit unsigned integer to a string.
 * Useful for message id parsing which is in uint64 format.
 * @param typedArray - typedArray
 * @returns The string representation of unsigned 64-bit integer.
 */
export function uint64ToStringLE(typedArray: Uint8Array) {
    const h =
        typedArray[4] +
        typedArray[5] * 0x100 +
        typedArray[6] * 0x10000 +
        typedArray[7] * 0x1000000;
    const l =
        typedArray[0] +
        typedArray[1] * 0x100 +
        typedArray[2] * 0x10000 +
        typedArray[3] * 0x1000000;

    const hd = Math.floor((h * H) / D + l / D);
    const ld = ((((h % D) * (H % D)) % D) + l) % D;
    const ldStr = String(ld);
    return (hd !== 0 ? hd + '0'.repeat(9 - ldStr.length) : '') + ldStr;
}
