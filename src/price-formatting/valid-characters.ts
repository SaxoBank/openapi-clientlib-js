import { extend } from '../utils/object';
import { getModernFractionsSeparator } from './modern-fractions-character';
import type NumberFormatting from '../number-formatting';
import type { Scenarios } from './types';

/**
 * Returns characters valid for entering prices.
 * @param {NumberFormatting} numberFormatting
 * @param {{integer: boolean, negative: boolean, price: boolean, numbers: boolean}} includeScenarios - The scenarios to get prices for.
 * @returns {string}
 */
function getValidPriceCharacters(
    numberFormatting: NumberFormatting,
    includeScenarios: Partial<Scenarios>,
) {
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
function getValidPriceRegex(
    numberFormatting: NumberFormatting,
    includeScenarios: Partial<Scenarios>,
) {
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

export { getValidPriceCharacters, getValidPriceRegex };
