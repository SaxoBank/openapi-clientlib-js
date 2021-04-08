import NumberFormatting from '../number-formatting';
import type { NumberOptions } from '../number-formatting';
import { format as formatTemplate } from '../utils/string';
import formatPrice from './format';
import type { FormatFlags } from './format';
import parsePrice from './parse';
import {
    getValidPriceCharacters,
    getValidPriceRegex,
} from './valid-characters';
import { getModernFractionsSeparator } from './modern-fractions-character';
import type { PriceFormatOption } from './format-options';
import type { Scenarios } from './types';
/**
 * Constructs a new PriceFormatting instance that can be used to format and parse prices.
 * @param {Object} [numberOptions] - See {@link saxo.Numbers} for possible number options.
 * @example
 * var priceFormatting = new PriceFormatting({decimalSeparator: ','});
 * var formattedPrice = priceFormatting.format(1.23, 2);
 */
class PriceFormatting {
    numberFormatting: NumberFormatting;

    constructor(numberOptions?: Partial<NumberOptions>) {
        this.numberFormatting = new NumberFormatting(numberOptions);
    }

    /**
     * Formats a number as a price string.
     * @param {number} value - Number to format.
     * @param {number} decimals  - The number of decimal places to display.
     * @param {string|Array.<string>} [formatOptions="Normal"] - The format flags to use when formatting
     *          If the flag is not recognized, it will be treated as if it is "Normal"
     * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
     * @returns {string} The formatting string.
     */
    format(
        value: number,
        decimals: number,
        formatOptions?:
            | PriceFormatOption
            | PriceFormatOption[]
            | FormatFlags
            | null,
        numeratorDecimals?: number,
    ) {
        const parts = formatPrice(
            this.numberFormatting,
            value,
            decimals,
            formatOptions,
            numeratorDecimals,
        );
        return (
            parts.Pre + parts.First + parts.Pips + parts.DeciPips + parts.Post
        );
    }

    /**
     * Formats a number as price parts.
     * @param {number} value - Number to format.
     * @param {number} decimals - The number of decimal places to display.
     * @param {string|Array.<string>} formatOptions - The format flags to use when formatting - see {@link saxo.priceFormatOptions}.
     * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
     * @returns formatted price parts.
     */
    formatPriceParts(
        value: number,
        decimals: number,
        formatOptions?: PriceFormatOption | PriceFormatOption[] | FormatFlags,
        numeratorDecimals?: number,
    ) {
        return formatPrice(
            this.numberFormatting,
            value,
            decimals,
            formatOptions,
            numeratorDecimals,
        );
    }

    /**
     * Formats a number using a template.
     * @param {number} value - Number to format.
     * @param {number} decimals - The number of decimal places to display.
     * @param {string|Array.<string>} formatOptions - The format flags to use when formatting.
     * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
     * @param {string} [templateStr="{Pre}{First}{Pips}<small>{DeciPips}</small>{Post}"] - The template string to use.
     * @returns {string} A formatted string.
     */
    formatTemplated(
        value: number,
        decimals: number,
        formatOptions?: PriceFormatOption,
        numeratorDecimals?: number,
        templateStr?: string,
    ) {
        if (!templateStr) {
            templateStr = '{Pre}{First}{Pips}<small>{DeciPips}</small>{Post}';
        }
        const parts = formatPrice(
            this.numberFormatting,
            value,
            decimals,
            formatOptions,
            numeratorDecimals,
        );
        return formatTemplate(templateStr, parts);
    }

    /**
     * Parses a string into a number.
     * @param {string} str - The number to parse.
     * @param {number} decimals - The number of decimals.
     * @param {string|Object.<string, boolean>} formatFlags - The format flags to use when parsing - see {@link saxo.priceFormatOptions}.
     * @returns {number}
     */
    parse(
        str: string,
        decimals: number,
        formatFlags?:
            | PriceFormatOption
            | PriceFormatOption[]
            | FormatFlags
            | null,
    ) {
        return parsePrice(this.numberFormatting, str, decimals, formatFlags);
    }

    /**
     * Returns characters valid for entering prices.
     * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
     * @returns {string}
     */
    getValidPriceCharacters(includeScenarios: Partial<Scenarios>) {
        return getValidPriceCharacters(this.numberFormatting, includeScenarios);
    }

    /**
     * Returns regex for validating characters for entering prices.
     * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
     * @returns {RegExp}
     */
    getValidPriceRegex(includeScenarios: Partial<Scenarios>) {
        return getValidPriceRegex(this.numberFormatting, includeScenarios);
    }

    /**
     * Returns the character that should be used as the modern fractions seperator
     * @returns {String}
     */
    getModernFractionsSeparator() {
        return getModernFractionsSeparator(this.numberFormatting);
    }
}

export default PriceFormatting;
