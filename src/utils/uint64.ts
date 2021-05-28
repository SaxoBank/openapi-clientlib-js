const H = 0x100000000;
const D = 1000000000;

/**
 * Converting array buffer (Uint8Array.buffer) storing uint64 integer to a string.
 * Useful for message id parsing which is in uint64 format.
 * @param buffer
 * @returns {string} - The string representation of unsigned 64-bit integer.
 */
export function uint64ToStringLE(buffer) {
    const h =
        buffer[4] +
        buffer[5] * 0x100 +
        buffer[6] * 0x10000 +
        buffer[7] * 0x1000000;
    const l =
        buffer[0] +
        buffer[1] * 0x100 +
        buffer[2] * 0x10000 +
        buffer[3] * 0x1000000;

    const hd = Math.floor((h * H) / D + l / D);
    const ld = ((((h % D) * (H % D)) % D) + l) % D;
    const ldStr = String(ld);
    return (hd !== 0 ? hd + '0'.repeat(9 - ldStr.length) : '') + ldStr;
}
