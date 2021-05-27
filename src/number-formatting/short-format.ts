import { extend } from '../utils/object';
import formatNumber from './format';
import type { NumberFormattingOptions } from '.';

/**
 * Converts from a number to a string like "1k" or "100m".
 * @param number - number to format
 * @param options - options
 * @returns  Returns 0 when dates are equal. -1 when date1 less than date2. 1 when date1 greater than date2.
 */
function shortFormat(
    number: number | string,
    options: NumberFormattingOptions,
) {
    number = Number(number);
    let prefix = '';
    let suffix = '';

    // denominations should always be in sorted order
    const notations = [
        {
            shortNotation: options.unitSuffixBillion,
            digitSize: 10,
            precisionDigits: 10,
            numDigits: 9,
        },
        {
            shortNotation: options.unitSuffixMillion,
            digitSize: 7,
            precisionDigits: 7,
            numDigits: 6,
        },
        {
            shortNotation: options.unitSuffixThousand,
            digitSize: 5,
            precisionDigits: 4,
            numDigits: 3,
        },
    ];

    if (number < 0) {
        // -10000 => -10k
        number = Math.abs(number);
        prefix = options.negativePre;
        suffix = options.negativePost;
    }

    const shortFormatOptions = extend({}, options, { isHideZeroTail: true });
    const [digits] = String(number).split('.');

    let numberPrecision = 0;
    let shortHandNotation = '';

    const digitSize = roundOffNumber(number, digits.length);

    for (let i = 0; i < notations.length; i++) {
        const notation = notations[i];
        if (digitSize >= notation.digitSize) {
            const { precisionDigits, numDigits, shortNotation } = notation;

            numberPrecision = 2 - (digitSize - precisionDigits);
            number /= Math.pow(10, numDigits);
            shortHandNotation = shortNotation;
            break;
        }
    }

    return `${prefix}${formatNumber(
        number,
        numberPrecision,
        shortFormatOptions,
    )}${suffix}${shortHandNotation}`;
}

function roundOffNumber(num: number, digitSize: number) {
    // If number is greater than 10,000 round off to closest number and increase digitSize accordingly.
    // Eg   99,950 is closer to 100,000 than 99.9k, so new digitSize will be increased to 6
    if (digitSize >= 5) {
        // bigger than 10,000
        const boundary =
            Math.pow(10, digitSize) - Math.pow(10, digitSize - 3) / 2; // e.g.  99,950 - closer to 100k than 99.9k
        if (num >= boundary) {
            digitSize++;
        }
    }

    return digitSize;
}

export default shortFormat;
