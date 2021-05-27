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
 * @param numberOptions - (optional) See {@link Numbers} for possible number options.
 * @example
 * ```ts
 * const priceFormatting = new PriceFormatting({decimalSeparator: ','});
 * const formattedPrice = priceFormatting.format(1.23, 2);
 * ```
 */
class PriceFormatting {
    numberFormatting: NumberFormatting;

    constructor(numberOptions?: Partial<NumberOptions>) {
        this.numberFormatting = new NumberFormatting(numberOptions);
    }

    /**
     * Formats a number as a price string.
     * @param value - Number to format.
     * @param decimals  - The number of decimal places to display.
     * @param formatOptions - (optional) The format flags to use when formatting
     *          If the flag is not recognized, it will be treated as if it is "Normal"
     * @param numeratorDecimals - (optional) The number of decimal places of the numerator in the case of fractions and modern fractions. Default = 0
     * @returns The formatting string.
     */
    format(
        value: number | undefined | null | string,
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
     * @param value - Number to format.
     * @param decimals - The number of decimal places to display.
     * @param formatOptions - The format flags to use when formatting - see {@link PriceFormatOption}.
     * @param numeratorDecimals - (optional) The number of decimal places of the numerator in the case of fractions and modern fractions. Default = 0
     * @returns formatted price parts.
     */
    formatPriceParts(
        value: number | undefined | null | string,
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
     * @param value - Number to format.
     * @param decimals - The number of decimal places to display.
     * @param formatOptions - (optional) The format flags to use when formatting.
     * @param numeratorDecimals - (optional) The number of decimal places of the numerator in the case of fractions and modern fractions.
     * @param templateStr - (optional) The template string to use. Default = `{Pre}{First}{Pips}<small>{DeciPips}</small>{Post}`
     * @returns A formatted string.
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
     * @param str - The number to parse.
     * @param decimals - The number of decimals.
     * @param formatFlags - The format flags to use when parsing - see {@link PriceFormatOption}.
     *
     */
    parse(
        str: string,
        decimals: number | null | undefined,
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
     * @param includeScenarios - The scenarios to get prices for.
     *
     */
    getValidPriceCharacters(includeScenarios: Partial<Scenarios>) {
        return getValidPriceCharacters(this.numberFormatting, includeScenarios);
    }

    /**
     * Returns regex for validating characters for entering prices.
     * @param includeScenarios - The scenarios to get prices for.
     *
     */
    getValidPriceRegex(includeScenarios: Partial<Scenarios>) {
        return getValidPriceRegex(this.numberFormatting, includeScenarios);
    }

    /**
     * Returns the character that should be used as the modern fractions seperator
     *
     */
    getModernFractionsSeparator() {
        return getModernFractionsSeparator(this.numberFormatting);
    }
}

export default PriceFormatting;
