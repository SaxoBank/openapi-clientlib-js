/**
 * @module saxo/number-formatting/parse
 * @ignore
 */

import { endsWith, startsWith } from '../utils/string';

// -- Local variables section --

const NO_BREAK_SPACE_REGEX = /\u00A0/g;

// -- Exported methods section --

export function parseNumberNegativePattern(value, options, tryFallback) {
    const pre = options.negativePre.replace(NO_BREAK_SPACE_REGEX, ' ');
    const post = options.negativePost.replace(NO_BREAK_SPACE_REGEX, ' ');
    value = value.replace(NO_BREAK_SPACE_REGEX, ' ');

    if (startsWith(value, pre) && endsWith(value, post)) {
        return [
            '-',
            value.substr(pre.length, value.length - (pre.length + post.length)),
        ];
    }

    if (tryFallback && startsWith(value, '-')) {
        return ['-', value.substr(1)];
    }

    return ['', value];
}

function parseNumber(value, options) {
    if (value == null) {
        return NaN;
    }

    value = value.trim();

    const signInfo = parseNumberNegativePattern(value, options, true);
    let sign = signInfo[0];
    const num = signInfo[1];
    if (sign === '') {
        sign = '+';
    }

    let exponent;
    let intAndFraction;
    let exponentPos = num.indexOf('e');
    if (exponentPos < 0) {
        exponentPos = num.indexOf('E');
    }
    if (exponentPos < 0) {
        intAndFraction = num;
        exponent = null;
    } else {
        intAndFraction = num.substr(0, exponentPos);
        exponent = num.substr(exponentPos + 1);
    }
    let integer;
    let fraction;
    const decimalPos = intAndFraction.indexOf(options.decimalSeparator);
    if (decimalPos < 0) {
        integer = intAndFraction;
        fraction = null;
    } else {
        integer = intAndFraction.substr(0, decimalPos);
        fraction = intAndFraction.substr(
            decimalPos + options.decimalSeparator.length,
        );
    }
    integer = integer.split(options.groupSeparator).join('');
    const altNumGroupSeparator = options.groupSeparator.replace(
        NO_BREAK_SPACE_REGEX,
        ' ',
    );
    if (options.groupSeparator !== altNumGroupSeparator) {
        integer = integer.split(altNumGroupSeparator).join('');
    }
    let p = sign + integer;
    if (fraction !== null) {
        p += '.' + fraction;
    }
    if (exponent !== null) {
        const expSignInfo = parseNumberNegativePattern(exponent, options);
        if (expSignInfo[0] === '') {
            expSignInfo[0] = '+';
        }
        p += 'e' + expSignInfo[0] + expSignInfo[1];
    }
    if (p.match(/^[+-]?\d*\.?\d*(e[+-]?\d+)?$/)) {
        return parseFloat(p);
    }
    return NaN;
}

// -- Export section --

export default parseNumber;
