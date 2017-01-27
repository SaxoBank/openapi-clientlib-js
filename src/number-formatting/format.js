/**
 * @module saxo/number-formatting/format
 * @ignore
 */

//-- Local variables section --

//-- Local methods section --

function formatNegativeNumber(str, options) {
	return options.negativePattern.replace("{0}", str);
}

/**
 * expands the number of decimals and introduces decimal groups.
 * @param number
 * @param precision
 * @param groupSizes
 * @param sep
 * @param decimalChar
 */
function expandNumber(number, precision, groupSizes, sep, decimalChar) {
	var curSize = groupSizes[0],
			curGroupIndex = 1,
			numberString = String(number),
			decimalIndex = numberString.indexOf('.'),
			right = "",
			i;

	if (decimalIndex > 0) {
		right = numberString.slice(decimalIndex + 1);
		numberString = numberString.slice(0, decimalIndex);
	}

	if (precision > 0) {
		var rightDifference = right.length - precision;
		if (rightDifference > 0) {
			right = right.slice(0, precision);
		} else if (rightDifference < 0) {
			var absRightDifference = Math.abs(rightDifference);
			for (i = absRightDifference - 1; i >= 0; i--) {
				right += '0';
			}
		}

		right = decimalChar + right;
	} else {
		right = "";
	}

	var stringIndex = numberString.length - 1;
	var ret = "";
	while (stringIndex >= 0) {
		if (curSize === 0 || curSize > stringIndex) {
			if (ret.length > 0) {
				return numberString.slice(0, stringIndex + 1) + sep + ret + right;
			}

			return numberString.slice(0, stringIndex + 1) + right;
		}

		if (ret.length > 0) {
			ret = numberString.slice(stringIndex - curSize + 1, stringIndex + 1) + sep + ret;
		} else {
			ret = numberString.slice(stringIndex - curSize + 1, stringIndex + 1);
		}

		stringIndex -= curSize;

		if (curGroupIndex < groupSizes.length) {
			curSize = groupSizes[curGroupIndex];
			curGroupIndex++;
		}
	}
	return numberString.slice(0, stringIndex + 1) + sep + ret + right;
}

//-- Exported methods section --

function formatNumber(inputNumber, decimals, options) {
	if (isNaN(inputNumber) || inputNumber === null || inputNumber === "") {
		return "";
	}


	// Does AwayFromZero rounding as per C# - see MidpointRound.AwayFromZero
	// When a number is halfway between two others, it is rounded toward the nearest number that is away from zero.
	// We do this by rounding the absolute number, so it always goes away from zero.
	var factor = Math.pow(10, decimals);
	var absoluteNumber = Math.abs(inputNumber);
	absoluteNumber = Math.round(absoluteNumber * factor) / factor;

	var formattedNumber = expandNumber(Math.abs(absoluteNumber),
								decimals,
								options.groupSizes,
								options.groupSeparator,
								options.decimalSeparator);

	// if the original is negative and it hasn't been rounded to 0
	if (inputNumber < 0 && absoluteNumber !== 0) {
		formattedNumber = formatNegativeNumber(formattedNumber, options);
	}

	return formattedNumber;
}

//-- Export section --

export default formatNumber;