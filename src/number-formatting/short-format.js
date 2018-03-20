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
 * @param precision
 * @param options
 * @returns {string} Returns 0 when dates are equal. -1 when date1 less than date2. 1 when date1 greater than date2.
 */
function shortFormat(num, options) {
    const shortFormatOptions = $.extend({}, options, { isHideZeroTail: true });
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
        const numberPrecision = (2 - (digitSize - 7));
        return formatNumber(num / 1000000, numberPrecision, shortFormatOptions) + 'm';
    }

    if (digitSize >= 5) { // > 9995 => 10.2k
        const numberPrecision = (2 - (digitSize - 4));
        return formatNumber(num / 1000, numberPrecision, shortFormatOptions) + 'k';
    }

    const numberPrecision = 0;
    return formatNumber(num, numberPrecision, shortFormatOptions);
}

// -- Export section --

export default shortFormat;
