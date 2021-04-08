import { extend } from '../utils/object';
import formatNumber from './format';
import parseNumber from './parse';
import shortFormat from './short-format';

const numberOfZerosRx = /0+$/;

export interface NumberOptions {
    groupSizes: number[];
    groupSeparator: string;
    decimalSeparator: string;
    negativePattern: string;
    unitSuffixThousand: string;
    unitSuffixMillion: string;
    unitSuffixBillion: string;
}

interface InternalOptions {
    negativePre: string;
    negativePost: string;
}

export interface NumberFormattingOptions
    extends NumberOptions,
        InternalOptions {}

/**
 * A class which does number formatting and parsing.
 * @param {Object} [options] - Number locale options.
 * @param {Array.<number>} [options.groupSizes=[3]] - The group sizes for the number.
 *          E.g. [3] would be thousands seperator and produce 123.456.789,00 where as [2,3] would be "12.34.56.789,00".
 * @param {string} [options.groupSeparator=","] - The character used for group separation E.g. '.' in Danish.
 * @param {string} [options.decimalSeparator="."] - The character used for decimal searation E.g.',' in Danish.
 * @param {string} [options.negativePattern="-{0}"] - The negative pattern to use with '{0}' as the placeholder for the non-negative number.
 */
class NumberFormatting implements NumberFormattingOptions {
    groupSizes = [3];
    groupSeparator = ',';
    decimalSeparator = '.';
    negativePattern = '-{0}';
    unitSuffixThousand = 'k';
    unitSuffixMillion = 'm';
    unitSuffixBillion = 'bn';
    negativePre = '';
    negativePost = '';

    constructor(options?: Partial<NumberOptions>) {
        extend(this, options || {});

        this.negativePre = this.negativePattern.substr(
            0,
            this.negativePattern.indexOf('{'),
        );
        this.negativePost = this.negativePattern.substr(
            this.negativePattern.indexOf('}') + 1,
        );
    }

    /**
     * Parses a localized string into a number.
     * @param {string} value - The number to parse.
     * @returns {number} parsed value
     */
    parse(value: string) {
        return parseNumber(value, this);
    }

    /**
     * Formats a number into a localized string.
     * @param {number} num - The number to format.
     * @param {number} [decimals] - The number of decimals to display after the decimal point.
     *                              If undefined then the number is formatted with however many
     *                              decimal places it needs to display the number (upto 8).
     * @returns {string}
     */
    format(num: number, decimals?: number) {
        if (decimals === undefined || decimals === null) {
            decimals = this.getActualDecimals(num);
        }

        return formatNumber(num, decimals, this);
    }

    /**
     * Formats the number without rounding. e.g. 1.12 formatted with 1 decimal place is "1.12".
     * @param {number} num - The number to format
     * @param {number} [minDecimals] - The minimum number of decimals to display after the decimal point.
     * @param {number} [maxDecimals] - The maximum number of decimals to display after the decimal point.
     * @returns {string}
     */
    formatNoRounding(num: number, minDecimals?: number, maxDecimals?: number) {
        if (!minDecimals) {
            minDecimals = 0;
        }
        if (!maxDecimals) {
            maxDecimals = 8;
        }

        return formatNumber(
            num,
            Math.min(
                maxDecimals,
                Math.max(minDecimals, this.getActualDecimals(num)),
            ),
            this,
        );
    }

    /**
     * Formats a number into a short format, e.g. 10.000 becomes 10k.
     * @param {number} number
     * @returns {string}
     */
    shortFormat(number: number) {
        return shortFormat(number, this);
    }

    /**
     * Returns the actual number of decimals that a number has.
     * @param number
     * @returns {number}
     */
    getActualDecimals(number: number) {
        number = Math.abs(number);
        return (number - Math.floor(number))
            .toFixed(8)
            .substring(2, 10)
            .replace(numberOfZerosRx, '').length;
    }
}

export default NumberFormatting;
