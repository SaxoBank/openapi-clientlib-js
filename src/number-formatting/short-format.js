/**
 * @module saxo/number-formatting/short-format
 * @ignore
 */

import { extend } from '../utils/object';
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
    let prefix = '';
    let suffix = '';

    const notationMap = {
        BILLION: {
            shortNotation: 'bn',
            digitSize: 10,
            precisionDigits: 10,
        },
        MILLION: {
            shortNotation: 'm',
            digitSize: 7,
            precisionDigits: 7,
        },
        THOUSAND: {
            shortNotation: 'k',
            digitSize: 5,
            precisionDigits: 4,
        },
    };

    if (num < 0) { // -10000 => -10k
        num = Math.abs(num);
        prefix = options.negativePre;
        suffix = options.negativePost;
    }

    const shortFormatOptions = extend({}, options, { isHideZeroTail: true });
    const [digits] = String(num).split('.');

    let notation;
    let numberPrecision = 0
    let shortNotation = '';

    let digitSize = roundOffNumber(num, digits.length);

    if (digitSize >= notationMap['BILLION'].digitSize) { // >= 1,000,000,000
        notation = 'BILLION';
        numberPrecision = (2 - (digitSize - precisionDigits));
        num = num / Math.pow(10, 9);
    } else if(digitSize >= notationMap['MILLION'].digitSize) { // >= 1,000,000
        notation = 'MILLION';
        num = num / Math.pow(10, 6);
    } else if(digitSize >= notationMap['THOUSAND'].digitSize) { // >= 10,000
        notation = 'THOUSAND';
        num = num / Math.pow(10, 3);
    }

    if(notationMap[notation]) {
        const precisionDigits = notationMap[notation].precisionDigits
        shortNotation = notationMap[notation].shortNotation;
        numberPrecision = (2 - (digitSize - precisionDigits));
    }

    return `${prefix}${formatNumber(num, numberPrecision, shortFormatOptions)}${suffix}${shortNotation}`;
}

function roundOffNumber(num, digitSize) {

    let boundary;

    // If number is greater than 10,000 round off to closest number and increase digitSize accordingly. 
    // Eg   99,950 is closer to 100,000 than 99.9k, so new digitSize will be increased to 6

    if (digitSize >= 5) { // bigger than 10,000
        boundary = Math.pow(10, digitSize) - (Math.pow(10, digitSize - 3) / 2); // e.g.  99,950 - closer to 100k than 99.9k
        if (num >= boundary) {
            digitSize++;
        }
    }

    return digitSize;
}

// -- Export section --

export default shortFormat;
