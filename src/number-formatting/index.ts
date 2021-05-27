import { extend } from '../utils/object';
import formatNumber from './format';
import parseNumber from './parse';
import shortFormat from './short-format';

const numberOfZerosRx = /0+$/;

export type NumberOptions = Readonly<{
    /**
     * The group sizes for the number.
     * @example
     * [3] would be thousands separator and produce 123.456.789,00 where as [2,3] would be "12.34.56.789,00".
     */
    groupSizes: Readonly<number[]>;
    /**
     * The character used for group separation E.g. '.' in Danish.
     */
    groupSeparator: string;
    /**
     * The character used for decimal separation E.g.',' in Danish.
     */
    decimalSeparator: string;
    /**
     * The negative pattern to use with `{0}` as the placeholder for the non-negative number.
     */
    negativePattern: string;
    unitSuffixThousand: string;
    unitSuffixMillion: string;
    unitSuffixBillion: string;
}>;

interface InternalOptions {
    negativePre: string;
    negativePost: string;
}

export interface NumberFormattingOptions
    extends NumberOptions,
        InternalOptions {}

/**
 * A class which does number formatting and parsing.
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

    /**
     * @param options - (optional) Number locale options. {@link NumberOptions}
     */
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
     * @param value - The number to parse.
     * @returns  parsed value
     */
    parse(value: string | null | undefined) {
        return parseNumber(value, this);
    }

    /**
     * Formats a number into a localized string.
     * @param num - The number to format.
     * @param decimals - (optional) The number of decimals to display after the decimal point.
     *                              If undefined then the number is formatted with however many
     *                              decimal places it needs to display the number (upto 8).
     *
     */
    format(num: number | null | undefined | string, decimals?: number | null) {
        if (decimals === undefined || decimals === null) {
            decimals =
                num === undefined || num === null
                    ? 0
                    : this.getActualDecimals(Number(num));
        }

        return formatNumber(num, decimals, this);
    }

    /**
     * Formats the number without rounding. e.g. 1.12 formatted with 1 decimal place is "1.12".
     * @param num - The number to format
     * @param minDecimals - (optional) The minimum number of decimals to display after the decimal point.
     * @param maxDecimals - (optional) The maximum number of decimals to display after the decimal point.
     * @returns formatted number string or an empty string when an invalid number was provided
     */
    formatNoRounding(
        num: number | null | undefined | string,
        minDecimals?: number | null,
        maxDecimals?: number | null,
    ) {
        if (num === null || num === undefined) {
            return '';
        }

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
                Math.max(minDecimals, this.getActualDecimals(Number(num))),
            ),
            this,
        );
    }

    /**
     * Formats a number into a short format, e.g. 10.000 becomes 10k.
     * @param number - number to format
     *
     */
    shortFormat(number: number | string | null | undefined) {
        if (number === undefined || number === null) {
            return '';
        }
        return shortFormat(number, this);
    }

    /**
     * Returns the actual number of decimals that a number has.
     * @param number - number or numeric string
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
