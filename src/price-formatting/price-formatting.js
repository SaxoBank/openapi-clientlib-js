/**
 * This module defines the Prices class.
 * @module saxo/price-formatting/price-formatting
 * @ignore
 */

import formatPrice from './format';
import parsePrice from './parse';
import NumberFormatting from '../number-formatting/number-formatting';
import { format as formatTemplate } from '../utils/string';
import {
    getValidPriceCharacters,
    getValidPriceRegex,
} from './valid-characters';
import { getModernFractionsSeparator } from './modern-fractions-character';

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * Constructs a new PriceFormatting instance that can be used to format and parse prices.
 * @class
 * @alias saxo.PriceFormatting
 * @param {Object} [numberOptions] - See {@link saxo.Numbers} for possible number options.
 * @example
 * var priceFormatting = new saxo.PriceFormatting({decimalSeparator: ','});
 * var formattedPrice = priceFormatting.format(1.23, 2);
 */
function PriceFormatting(numberOptions) {
    this.numberFormatting = new NumberFormatting(numberOptions);
}

/**
 * Formats a number as a price string.
 * @param {number} value - Number to format.
 * @param {number} decimals  - The number of decimal places to display.
 * @param {string|Object.<string, boolean>} [formatFlags="Normal"] - The format flags to use when formatting
 *          - see {@link saxo.priceFormatOptions}. If the flag is not recognised, it will be treated as if it is "Normal"
 * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
 * @returns {string} The formatting string.
 */
PriceFormatting.prototype.format = function(
    value,
    decimals,
    formatFlags,
    numeratorDecimals,
) {
    const parts = formatPrice(
        this.numberFormatting,
        value,
        decimals,
        formatFlags,
        numeratorDecimals,
    );
    return parts.Pre + parts.First + parts.Pips + parts.DeciPips + parts.Post;
};

/**
 * An object representing a price that has been split up into parts.
 * @typedef {Object} saxo.PriceParts
 * @property {string} Pre - Anything appearing before the price, like the negative symbol "-".
 * @property {string} Post - Anything appearing after the price, like in some cultures the negative symbol "-".
 * @property {string} First - The first part of the price, e.g. "1.98".
 * @property {string} Pips - The pips for the price, if present e.g. "76".
 * @property {string} DeciPips - The deci-pips for the price if present e.g. "7".
 */

/**
 * Formats a number as price parts.
 * @param {number} value - Number to format.
 * @param {number} decimals - The number of decimal places to display.
 * @param {string|Object.<string, boolean>} formatFlags - The format flags to use when formatting - see {@link saxo.priceFormatOptions}.
 * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
 * @returns {saxo.PriceParts} formatted price parts.
 */
PriceFormatting.prototype.formatPriceParts = function(
    value,
    decimals,
    formatFlags,
    numeratorDecimals,
) {
    return formatPrice(
        this.numberFormatting,
        value,
        decimals,
        formatFlags,
        numeratorDecimals,
    );
};

/**
 * Formats a number using a template.
 * @param {number} value - Number to format.
 * @param {number} decimals - The number of decimal places to display.
 * @param {string|Object.<string, boolean>} formatFlags - The format flags to use when formatting - see {@link saxo.priceFormatOptions}.
 * @param {number} [numeratorDecimals=0] - The number of decimal places of the numerator in the case of fractions and modern fractions.
 * @param {string} [templateStr="{Pre}{First}{Pips}<small>{DeciPips}</small>{Post}"] - The template string to use.
 * @returns {string} A formatted string.
 */
PriceFormatting.prototype.formatTemplated = function(
    value,
    decimals,
    formatFlags,
    numeratorDecimals,
    templateStr,
) {
    if (!templateStr) {
        templateStr = '{Pre}{First}{Pips}<small>{DeciPips}</small>{Post}';
    }
    const parts = formatPrice(
        this.numberFormatting,
        value,
        decimals,
        formatFlags,
        numeratorDecimals,
    );
    return formatTemplate(templateStr, parts);
};

/**
 * Parses a string into a number.
 * @param {string} str - The number to parse.
 * @param {number} decimals - The number of decimals.
 * @param {string|Object.<string, boolean>} formatFlags - The format flags to use when parsing - see {@link saxo.priceFormatOptions}.
 * @returns {number}
 */
PriceFormatting.prototype.parse = function(str, decimals, formatFlags) {
    return parsePrice(this.numberFormatting, str, decimals, formatFlags);
};

/**
 * Returns characters valid for entering prices.
 * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
 * @returns {string}
 */
PriceFormatting.prototype.getValidPriceCharacters = function(includeScenarios) {
    return getValidPriceCharacters(this.numberFormatting, includeScenarios);
};

/**
 * Returns regex for validating characters for entering prices.
 * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
 * @returns {RegExp}
 */
PriceFormatting.prototype.getValidPriceRegex = function(includeScenarios) {
    return getValidPriceRegex(this.numberFormatting, includeScenarios);
};

/**
 * Returns the character that should be used as the modern fractions seperator
 * @returns {String}
 */
PriceFormatting.prototype.getModernFractionsSeparator = function() {
    return getModernFractionsSeparator(this.numberFormatting);
};

// -- Export section --

export default PriceFormatting;
