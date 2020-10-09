/**
 * @module saxo/price-formatting/valid-character
 * @ignore
 */

import { extend } from 'src/utils/object';
import { getModernFractionsSeparator } from './modern-fractions-character';

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * Returns characters valid for entering prices.
 * @param {NumberFormatting} numberFormatting
 * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
 * @returns {string}
 */
function getValidPriceCharacters(numberFormatting, includeScenarios) {
    let characters;

    if (!includeScenarios) {
        includeScenarios = {};
    }

    characters = numberFormatting.groupSeparator;

    if (characters.charCodeAt(0) === 160) {
        // if non breaking space
        characters += ' '; // add normal space
    }

    if (!includeScenarios.integer) {
        characters += numberFormatting.decimalSeparator;
    }

    if (includeScenarios.negative) {
        characters += numberFormatting.negativePattern.replace('{0}', '');
    }

    if (includeScenarios.price) {
        characters +=
            getModernFractionsSeparator(numberFormatting) +
            ' /' +
            String.fromCharCode(160);
    }

    if (includeScenarios.numbers !== false) {
        characters += '0123456789';
    }

    return characters;
}

/**
 * Returns regex for validating characters for entering prices.
 * @param {NumberFormatting} numberFormatting
 * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
 * @returns {RegExp}
 */
function getValidPriceRegex(numberFormatting, includeScenarios) {
    const valid = getValidPriceCharacters(
        numberFormatting,
        extend({}, includeScenarios || {}, { numbers: false }),
    );
    let regex = '';

    for (let i = 0; i < valid.length; i++) {
        regex += '\\x' + valid.charCodeAt(i).toString(16);
    }

    return new RegExp('^[\\d' + regex + ']+$');
}

// -- Export section --

export { getValidPriceCharacters, getValidPriceRegex };
