import type { NumberFormattingOptions } from '.';

interface Options extends NumberFormattingOptions {
    isHideZeroTail?: boolean;
}

function formatNegativeNumber(str: string, options: Options) {
    return options.negativePattern.replace('{0}', str);
}

/**
 * converts a number to a decimal string if it is on scientific notation
 * @param number - number
 * @param precision - precision
 */
function convertNumberToString(number: number, precision: number) {
    let numberString = String(number);

    // if the number is in scientific notation, convert to decimal
    if (/\d+\.?\d*e[+-]*\d+/i.test(numberString)) {
        numberString = number.toFixed(precision);
    }

    return numberString;
}

/**
 * expands the number of decimals and introduces decimal groups.
 * @param number - number
 * @param precision - precision
 * @param options - options
 */
function expandNumber(number: number, precision: number, options: Options) {
    const { groupSizes, groupSeparator, decimalSeparator, isHideZeroTail } =
        options;
    let curSize = groupSizes[0];
    let curGroupIndex = 1;
    let numberString = convertNumberToString(number, precision);
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
                    numberString.slice(0, stringIndex + 1) +
                    groupSeparator +
                    ret +
                    right
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
            ret = numberString.slice(
                stringIndex - curSize + 1,
                stringIndex + 1,
            );
        }

        stringIndex -= curSize;

        if (curGroupIndex < groupSizes.length) {
            curSize = groupSizes[curGroupIndex];
            curGroupIndex++;
        }
    }
    return (
        numberString.slice(0, stringIndex + 1) + groupSeparator + ret + right
    );
}

function roundNumber(number: number, decimals: number) {
    // Shift with exponential notation to avoid floating-point issues.
    const pair = `${number}e`.split('e');
    const value = Math.round(
        Number(`${pair[0]}e${Number(pair[1]) + decimals}`),
    );
    const factor = Math.pow(10, decimals);

    return value / factor;
}

function isNumeric(
    number: number | string | null | undefined,
): number is number | string {
    return !isNaN(number as any) && number !== null && number !== '';
}

function formatNumber(
    inputNumber: number | string | null | undefined,
    decimals: number,
    options: Options,
) {
    if (!isNumeric(inputNumber)) {
        return '';
    }

    inputNumber = Number(inputNumber);

    // Does AwayFromZero rounding as per C# - see MidpointRound.AwayFromZero
    // When a number is halfway between two others, it is rounded toward the nearest number that is away from zero.
    // We do this by rounding the absolute number, so it always goes away from zero.
    const absoluteNumber = Math.abs(inputNumber);
    const roundedNumber = roundNumber(absoluteNumber, decimals);

    let formattedNumber = expandNumber(
        Math.abs(roundedNumber),
        decimals,
        options,
    );

    // if the original is negative and it hasn't been rounded to 0
    if (inputNumber < 0 && roundedNumber !== 0) {
        formattedNumber = formatNegativeNumber(formattedNumber, options);
    }

    return formattedNumber;
}

export default formatNumber;
