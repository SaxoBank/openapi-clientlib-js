/**
 * @module saxo/price-formatting/parse
 * @ignore
 */

import * as enumUtils from '../utils/enum';
import { getModernFractionsSeparator } from './modern-fractions-character';

// -- Local variables section --

const divisionChars = ['/', String.fromCharCode(0x2044), String.fromCharCode(0x2215)];
const fractionChars = [String.fromCharCode(0xBC), String.fromCharCode(0xBD), String.fromCharCode(0xBE), String.fromCharCode(0x2153),
    String.fromCharCode(0x2154), String.fromCharCode(0x2155), String.fromCharCode(0x2156), String.fromCharCode(0x2157), String.fromCharCode(0x2158),
    String.fromCharCode(0x2159), String.fromCharCode(0x215A), String.fromCharCode(0x215B), String.fromCharCode(0x215C), String.fromCharCode(0x215D),
    String.fromCharCode(0x215E)];
const fractionCharsValues = [1 / 4, 1 / 2, 3 / 4, 1 / 3,
    2 / 3, 1 / 5, 2 / 5, 3 / 5, 4 / 5,
    1 / 6, 5 / 6, 1 / 8, 3 / 8, 5 / 8,
    7 / 8];

// -- Local methods section --

/**
 * Returns the index in the haystack of the string that contains needle e.g.
 * @param {string} needle
 * @param {Array.<string>} haystack
 * @returns {string}
 * @example
 * indexOfArray("b", ["apple", "bannana"]) === 1;
 * indexOfArray("p", ["apple", "bannana"]) === 0;
 * indexOfArray("z", ["apple", "bannana"]) === -1;
 */
function indexOfArray(needle, haystack) {
    let index;
    for (let i = 0; i < haystack.length; i++) {
        index = needle.indexOf(haystack[i]);
        if (index > -1) {
            return index;
        }
    }
    return -1;
}

/**
 * Finds the fractional part of a price formatted with negative decimals.
 * e.g. 1 234 31 / 64
 * ->   1234 31/64
 * So the last whitespace before the last digit(s) before the fractional char.
 * @param value
 */
function findFractionalPart(value) {
    let index = -1;

    const divIndex = indexOfArray(value, divisionChars);

    if (divIndex > 0) { // -1 not found, 0 means nothing before
        index = divIndex - 1;
        let foundDigit = false;
        while (index >= 0) {
            if (foundDigit && isNaN(parseInt(value.substring(index, index + 1), 10))) {
                break;
            } else if (!isNaN(value.substring(index, index + 1))) {
                foundDigit = true;
            }

            --index;
        }
        if (foundDigit && index < 0) {
            index = 0;
        }
    } else {
        index = indexOfArray(value, fractionChars);
    }

    return index;
}

function parseDecimalprice(numberFormatting, s, formatFlags) {

    if (formatFlags.Percentage) {
        s = s.replace(/\s*%\s*$/, '');
    }

    if (!formatFlags.DeciPipsSpaceSeparator &&
        !formatFlags.DeciPipsDecimalSeparator &&
        !formatFlags.DeciPipsFraction) {

        let result = numberFormatting.parse(s);

        if (formatFlags.Percentage) {
            result /= 100;
        }

        return result;
    }
    return 0;
}

function parseFractionalPrice(numberFormatting, s, formatFlags, decimals) {

    let result;

    if (formatFlags.ModernFractions) {
        // special futures

        const separator = getModernFractionsSeparator(numberFormatting);
        const denominator = 1 << decimals;

        const pipIndex = s.indexOf(separator);
        if (pipIndex !== -1) {
            const integerPart = s.substring(0, pipIndex).trim();
            if (integerPart.length > 0) {
                result = numberFormatting.parse(integerPart);
            } else {
                result = 0;
            }

            if (pipIndex + 1 < s.length) {
                const pipPart = numberFormatting.parse(s.substring(pipIndex + 1).trim());

                if (pipPart < denominator) {
                    result = result += (pipPart / denominator);
                } else {
                    result = NaN;
                }
            }
        } else {
            result = numberFormatting.parse(s);
        }
    } else {
        const fracIndex = findFractionalPart(s);

        if (fracIndex !== -1 && fracIndex < s.length) {
            const integerPart = s.substring(0, fracIndex).trim();
            result = (integerPart.length > 0 ? numberFormatting.parse(integerPart) : 0.0);

            const fractionalPart = s.substring(fracIndex).trim();
            let isVulgarFraction = false;

            if (fractionalPart.length === 1) {
                const vulgarIndex = fractionChars.indexOf(fractionalPart);
                if (vulgarIndex >= 0) {
                    result += fractionCharsValues[vulgarIndex];
                    isVulgarFraction = true;
                }
            }

            if (!isVulgarFraction) {
                const divIndex = indexOfArray(fractionalPart, divisionChars);
                if (divIndex !== -1 && divIndex < fractionalPart.length) {
                    const numeratorPart = fractionalPart.substring(0, divIndex).trim();
                    const denominatorPart = fractionalPart.substring(divIndex + 1).trim();

                    const numeratorParsed = parseFloat(numeratorPart);
                    const denominatorParsed = parseFloat(denominatorPart);
                    if (numeratorParsed < denominatorParsed) {
                        const frac = numeratorParsed / denominatorParsed;
                        if (result >= 0) {
                            result += frac;
                        } else {
                            result -= frac;
                        }
                    } else {
                        result = 0;
                    }
                } else {
                    result = 0;
                }
            }
        } else {
            result = parseInt(s, 10);
        }
    }
    return result;
}

// -- Exported methods section --

/**
 * From IitClientStation/Parsing.cs TryParsePrice().
 * Parses a text string to a price value.
 * @param numberFormatting
 * @param str
 * @param decimals
 * @param formatFlags
 * @returns {number} The passed value, 0 if not parsed.
 */
function parsePrice(numberFormatting, str, decimals, formatFlags) {

    if (str == null) {
        return NaN;
    }

    if (formatFlags) {
        formatFlags = enumUtils.toObject(formatFlags);
    } else {
        formatFlags = { Normal: true };
    }

    if (decimals < 0) {
        throw new Error('This library supports the openapi format specification, so fractions are done with ' +
            'positive decimals and the Fractions or ModernFractions flag');
    }

    let s = String(str).trim();

    // TrimLeadingNumberGroupSeparator
    if (s.substr(0, 1) === numberFormatting.groupSeparator) {
        if (s.length > numberFormatting.groupSeparator.length) {
            s = s.substring(numberFormatting.groupSeparator.length);
        }
    }

    if (!s) { // null, undefined, ""
        return NaN;
    }

    try {
        if (formatFlags.ModernFractions || formatFlags.Fractions) {
            return parseFractionalPrice(numberFormatting, s, formatFlags, decimals);
        }
        return parseDecimalprice(numberFormatting, s, formatFlags);

    } catch (e) {
        return NaN;
    }
}

// -- Export section --

export default parsePrice;
