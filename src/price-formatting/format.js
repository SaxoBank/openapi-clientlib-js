/**
 * @module saxo/price-formatting/format
 * @ignore
 */

import * as enumUtils from '../utils/enum';
import { getModernFractionsSeparator } from './modern-fractions-character';
import formatNumber from '../number-formatting/format';
import { endsWith, multiply, padLeft } from '../utils/string';

// -- Local variables section --

const NO_BREAK_SPACE = String.fromCharCode(0xa0);

// -- Local methods section --

function getFirstAndPipsParts(price, parts, numberFormatting) {
    const minSize = (price.indexOf(numberFormatting.decimalSeparator) < 0 ? 2 : 3);
    if (price.length > minSize) {
        let pc = 2;
        parts.Pips = price.substr(price.length - pc, pc);
        if (parts.Pips.indexOf(numberFormatting.decimalSeparator) >= 0) {
            pc = 3;
            parts.Pips = price.substr(price.length - pc, pc);
        }
        parts.First = price.substr(0, price.length - pc);
    } else {
        parts.First = price;
        parts.Pips = '';
    }
}

function getFormatAsPipsParts(basePart, parts, decimals, numberFormatting) {
    const price = numberFormatting.parse(basePart);
    const pips = price * Math.pow(10, decimals);
    parts.First = '';
    parts.DeciPips = numberFormatting.decimalSeparator + parts.DeciPips;
    parts.Pips = formatNumber(pips, 0, numberFormatting);
}

function formatPricePartsFraction(parts, numberFormatting, value, decimals, formatFlags, numeratorDecimals) {

    let minDecimals = 0;
    let maxDecimals = 8;
    if (formatFlags.ModernFractions) {
        minDecimals = 5;
        maxDecimals = 7;
    }
    decimals = Math.max(minDecimals, Math.min(maxDecimals, decimals));
    let denominator = 1 << Math.min(8, decimals);

    let integerPart = Math.floor(value);
    const fractionalPart = value - integerPart;
    let numerator = fractionalPart * denominator;

    numeratorDecimals = numeratorDecimals || 0;
    if (formatFlags.NoRounding) {
        numeratorDecimals = Math.max(numberFormatting.getActualDecimals(numerator), numeratorDecimals);
    } else {
        // now round it to the resolution.
        // we could also just assume it is in the right resolution e.g. rounded to the tick size
        const resolution = 1 << numeratorDecimals;
        numerator = Math.round(numerator * resolution) / resolution;
    }

    let numeratorText = formatNumber(numerator, numeratorDecimals, numberFormatting);
    const denominatorText = formatNumber(denominator, 0, numberFormatting);
    let fractionalPartText = ''; // Not really pips - just fractional part string

    if (denominatorText === numeratorText) {
        numeratorText = '0';
        denominator = 0.0;
        integerPart += 1;
    }

    const first = formatNumber(integerPart, 0, numberFormatting);

    if (formatFlags.ModernFractions) { // Special futures format
        const separator = getModernFractionsSeparator(numberFormatting);
        let padSize;
        if (numeratorDecimals === 0) {
            padSize = 2; // two 'integer' numerator digits
        } else {
            padSize = numeratorDecimals + 3;     // two digits + seperator + all the decimal bits
        }

        fractionalPartText = separator + padLeft(numeratorText, padSize, '0');
    } else if (numeratorText === '0' && !formatFlags.IncludeZeroFractions) {
        if (formatFlags.AdjustFractions) { // # spaces = Separator + #d spaces + fraction slash space + #n spaces
            fractionalPartText = multiply(NO_BREAK_SPACE, 1 + 2 * denominatorText.length + 1);
        }
    } else {
        if (formatFlags.AdjustFractions && numeratorText.length < denominatorText.length) {
            numeratorText = padLeft(numeratorText, denominatorText.length, NO_BREAK_SPACE);
        }

        // use NO-BREAK SPACE to separate fraction
        fractionalPartText = NO_BREAK_SPACE + numeratorText + '/' + denominatorText;
    }

    parts.First = first;
    parts.Pips = fractionalPartText;
    parts.DeciPips = '';
}

function getAllowDecimalPipsParts(formatFlags, basePart, deciPipsPart, numberFormatting) {
    if (!formatFlags.DeciPipsSpaceSeparator && !formatFlags.DeciPipsDecimalSeparator) {
        if (endsWith(basePart, numberFormatting.decimalSeparator)) {
            basePart = basePart.substr(0, basePart.length - 1);
            deciPipsPart = numberFormatting.decimalSeparator + deciPipsPart;
        }
    } else if (formatFlags.DeciPipsDecimalSeparator) {
        if (endsWith(basePart, numberFormatting.decimalSeparator)) {
            basePart = basePart.substr(0, basePart.length - 1);
            deciPipsPart = numberFormatting.decimalSeparator + deciPipsPart;
        } else {
            deciPipsPart = numberFormatting.decimalSeparator + deciPipsPart;
        }

        // else SpaceSeparator
    } else if (endsWith(basePart, numberFormatting.decimalSeparator)) {
        basePart = basePart.substr(0, basePart.length - 1);
        deciPipsPart = numberFormatting.decimalSeparator + deciPipsPart;
    } else {
        deciPipsPart = NO_BREAK_SPACE + deciPipsPart;
    }

    return { basePart, deciPipsPart };
}

function getFractionParts(formatFlags, basePart, deciPipsPart, numberFormatting) {
    let deciPipsIsFractionalPart = false;

    if (endsWith(basePart, numberFormatting.decimalSeparator)) {
        basePart = basePart.substr(0, basePart.length - 1);
        deciPipsIsFractionalPart = true;
    }

    if (deciPipsPart === '5') {
        deciPipsPart = String.fromCharCode(0xBD);
        deciPipsIsFractionalPart = false;
    } else if (formatFlags.DeciPipsSpaceForZero && deciPipsPart === '0') {
        deciPipsPart = NO_BREAK_SPACE;
        deciPipsIsFractionalPart = false;
    }

    if (formatFlags.DeciPipsSpaceSeparator) {
        deciPipsPart = NO_BREAK_SPACE + deciPipsPart;
    } else if (deciPipsIsFractionalPart) {
        deciPipsPart = numberFormatting.decimalSeparator + deciPipsPart;
    }

    return { basePart, deciPipsPart };
}

function formatPricePartsDecimals(parts, numberFormatting, value, decimals, formatFlags, pipDecimals) {

    let actualDecimals;

    if (formatFlags.Percentage && formatFlags.NoRounding) {
        throw new Error('No rounding is not supported on percentage');
    }

    if (formatFlags.NoRounding) {
        actualDecimals = numberFormatting.getActualDecimals(value);
        if (actualDecimals <= decimals) {
            formatFlags.NoRounding = false;
        }
    }

    if (formatFlags.Percentage) {
        parts.First = formatNumber(value * 100, decimals, numberFormatting) + ' %';
    } else if (formatFlags.NoRounding || (!formatFlags.AllowDecimalPips && !formatFlags.DeciPipsFraction)) {
        getFirstAndPipsParts(formatNumber(value, formatFlags.NoRounding ? actualDecimals : decimals, numberFormatting), parts, numberFormatting);
    } else {
        const pipDecimalsCount = pipDecimals || 1;
        const totalDecimals = decimals + pipDecimalsCount;
        const fullPrice = formatNumber(value, totalDecimals, numberFormatting);

        // basePart may contain a decimal separator that may or may not need to be removed
        let basePart = fullPrice.substr(0, fullPrice.length - pipDecimalsCount);
        let deciPipsPart = fullPrice.substr(fullPrice.length - pipDecimalsCount, pipDecimalsCount);

        if (formatFlags.AllowDecimalPips && !formatFlags.FormatAsPips) {
            const updatedParts = getAllowDecimalPipsParts(formatFlags, basePart, deciPipsPart, numberFormatting);
            basePart = updatedParts.basePart;
            deciPipsPart = updatedParts.deciPipsPart;
        } else { // Fraction
            const updatedParts = getFractionParts(formatFlags, basePart, deciPipsPart, numberFormatting);
            basePart = updatedParts.basePart;
            deciPipsPart = updatedParts.deciPipsPart;
        }

        parts.DeciPips = deciPipsPart;

        if (formatFlags.FormatAsPips) {
            getFormatAsPipsParts(basePart, parts, decimals, numberFormatting);
        } else {
            getFirstAndPipsParts(basePart, parts, numberFormatting);
        }
    }
}

/**
 * Formats a number to an object of price parts
 * @param numberFormatting
 * @param value
 * @param decimals
 * @param formatFlags
 * @param numeratorDecimals
 * @param pipDecimals
 * @returns {PriceParts}
 */
function formatPriceParts(numberFormatting, value, decimals, formatFlags, numeratorDecimals, pipDecimals) {

    const parts = { Pre: '', Post: '', First: '', Pips: '', DeciPips: '' };

    if (isNaN(value) || value === null || value === '') {
        return parts;
    }

    const isNegative = value < 0;
    value = Math.abs(value);

    if (formatFlags.ModernFractions || formatFlags.Fractions) {
        formatPricePartsFraction(parts, numberFormatting, value, decimals, formatFlags, numeratorDecimals);
    } else {
        formatPricePartsDecimals(parts, numberFormatting, value, decimals, formatFlags, pipDecimals);
    }

    if (isNegative) {

        // Infinitesimally small negative value is rounded to 0 in which case Pre/Post (for some languages) should not be '-',
        // as '-0'/'0-' makes no sense, hence the below check.
        parts.Post = (parts.First === '0' && !parts.Pips && !parts.DeciPips) ? '' : numberFormatting.negativePost;
        parts.Pre = (parts.First === '0' && !parts.Pips && !parts.DeciPips) ? '' : numberFormatting.negativePre;
    }

    return parts;
}

// -- Exported methods section --

/**
 * Formats a price value with the specified options.
 * @param {NumberFormatting} numberFormatting
 * @param {number} value - The price value to format.
 * @param {number} decimals
 * @param {string|Object.<string, boolean>} [formatFlags="Normal"] - Indicates if the price also include
 *          half-pips (decimal pips), and which format should be used.
 * @param {number} [numeratorDecimals=0] - In the case of Fractions or ModernFractions, this is the number of decimals on the fraction numerator
 * @param {number} pipDecimals - In the case of AllowDecimalPips, the number of digits to format as decimal pips. Defaults to 1.
 * @returns {PriceParts} An object containing the formatted price.
 */
function formatPrice(numberFormatting, value, decimals, formatFlags, numeratorDecimals, pipDecimals) {

    if (formatFlags) {
        formatFlags = enumUtils.toObject(formatFlags);
    } else {
        formatFlags = { Normal: true };
    }

    if (typeof decimals !== 'number') {
        throw new Error('Decimals are required in price formatting functions');
    }

    if (decimals < 0) {
        throw new Error('This library supports the openapi format specification, so fractions are done' +
            'with positive decimals and the Fractions or ModernFractions flag');
    }

    const parts = formatPriceParts(numberFormatting, value, decimals, formatFlags, numeratorDecimals, pipDecimals);

    return parts;
}

// -- Export section --

export default formatPrice;
