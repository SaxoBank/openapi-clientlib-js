/**
 * @module saxo/number-formatting/format
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

function formatNegativeNumber(str, options) {
    return options.negativePattern.replace('{0}', str);
}

function isScientificNotation(number) {
    const numberString = String(number);
    return /\d+\.?\d*e[+-]*\d+/i.test(numberString);
}

/**
 * converts a number to a decimal string if it is on scientific notation
 * @param number
 */
function convertNumbertToString(number, precision) {
    let numberString = String(number);

    // if the number is in scientific notation, convert to decimal
    if (isScientificNotation(number)) {
        numberString = number.toFixed(precision).trim('0');
    }

    return numberString;
}

/**
 * expands the number of decimals and introduces decimal groups.
 * @param number
 * @param precision
 * @param { groupSizes, groupSeparator, decimalSeparator, isHideZeroTail } options
 */
function expandNumber(number, precision, options) {
    const { groupSizes, groupSeparator, decimalSeparator, isHideZeroTail } = options;
    let curSize = groupSizes[0];
    let curGroupIndex = 1;
    let numberString = convertNumbertToString(number, precision);
    const decimalIndex = numberString.indexOf('.');
    let right = '';
    let i;

    if (decimalIndex > 0) {
        right = numberString.slice(decimalIndex + 1);
        numberString = numberString.slice(0, decimalIndex);
    }

    const isTailOnlyZeroDigit = Number(right) === 0;
    const isAllowZeroTail = !(isHideZeroTail && isTailOnlyZeroDigit);

    if (precision > 0 && isAllowZeroTail) {
        const rightDifference = right.length - precision;
        if (rightDifference > 0) {
            right = right.slice(0, precision);
        } else if (rightDifference < 0) {
            const absRightDifference = Math.abs(rightDifference);
            for (i = absRightDifference - 1; i >= 0; i--) {
                right += '0';
            }
        }

        right = decimalSeparator + right;
    } else {
        right = '';
    }

    let stringIndex = numberString.length - 1;
    let ret = '';
    while (stringIndex >= 0) {
        if (curSize === 0 || curSize > stringIndex) {
            if (ret.length > 0) {
                return (
                    numberString.slice(0, stringIndex + 1) + groupSeparator + ret + right
                );
            }

            return numberString.slice(0, stringIndex + 1) + right;
        }

        if (ret.length > 0) {
            ret =
                numberString.slice(stringIndex - curSize + 1, stringIndex + 1) +
                groupSeparator +
                ret;
        } else {
            ret = numberString.slice(stringIndex - curSize + 1, stringIndex + 1);
        }

        stringIndex -= curSize;

        if (curGroupIndex < groupSizes.length) {
            curSize = groupSizes[curGroupIndex];
            curGroupIndex++;
        }
    }
    return numberString.slice(0, stringIndex + 1) + groupSeparator + ret + right;
}

// Does AwayFromZero rounding as per C# - see MidpointRound.AwayFromZero
// When a number is halfway between two others, it is rounded toward the nearest number that is away from zero.
// We do this by rounding the absolute number, so it always goes away from zero.
function roundNumber(number, decimals) {
    const factor = Math.pow(10, decimals);
    const absoluteNumber = Math.abs(number);
    const isScientificNotationNumber = isScientificNotation(absoluteNumber);

    // for not exponential numbers we use exponential rounding to avoid binary floating-point issue like 1.005 * 100 !== 100.5
    if (isScientificNotationNumber) {
        return Math.round(absoluteNumber * factor) / factor;
    }
    const roundedNumber = Math.round(`${absoluteNumber}e${decimals}`);

    return Number(`${roundedNumber}e-${decimals}`);
}

// -- Exported methods section --

function formatNumber(inputNumber, decimals, options) {
    if (isNaN(inputNumber) || inputNumber === null || inputNumber === '') {
        return '';
    }

    const absoluteNumber = roundNumber(inputNumber, decimals);

    let formattedNumber = expandNumber(Math.abs(absoluteNumber), decimals, options);

    // if the original is negative and it hasn't been rounded to 0
    if (inputNumber < 0 && absoluteNumber !== 0) {
        formattedNumber = formatNegativeNumber(formattedNumber, options);
    }

    return formattedNumber;
}

// -- Export section --

export default formatNumber;
