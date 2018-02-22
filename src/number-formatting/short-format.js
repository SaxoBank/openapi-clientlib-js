/**
 * @module saxo/number-formatting/short-format
 * @ignore
 */

import formatNumber from './format';

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * Converts from a number to a string like "1k" or "100m".
 * @param num
 * @param options
 * @returns {string} Returns 0 when dates are equal. -1 when date1 less than date2. 1 when date1 greater than date2.
 */
function shortFormat(num, precision, options) {
    const [digits] = String(num).split('.');
    let digitSize = digits.length;
    let boundary;

    if (digitSize >= 5) { // bigger than 10,000
        boundary = Math.pow(10, digitSize) - (Math.pow(10, digitSize - 3) / 2); // e.g. 100,000 -> 9,9950 - closer to 100k than 99.9k
        if (num >= boundary) {
            digitSize++;
        }
    }

    if (digitSize >= 7) { // > 999500
        const digitPrecision = !isNaN(precision) ? precision : (2 - (digitSize - 7));
        return formatNumber(num / 1000000, digitPrecision, options) + 'm';
    }

    if (digitSize >= 5) { // > 9995 => 10.2k
        const digitPrecision = !isNaN(precision) ? precision : (2 - (digitSize - 4));
        return formatNumber(num / 1000, digitPrecision, options) + 'k';
    }

    return formatNumber(num, 0, options);
}

// -- Export section --

export default shortFormat;
