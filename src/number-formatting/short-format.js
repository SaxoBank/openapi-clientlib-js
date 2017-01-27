/**
 * @module saxo/number-formatting/short-format
 * @ignore
 */

import formatNumber  from './format';

//-- Local variables section --

//-- Local methods section --

//-- Exported methods section --

/**
 * Converts from a number to a string like "1k" or "100m".
 * @param num
 * @param options
 * @returns {string} Returns 0 when dates are equal. -1 when date1 less than date2. 1 when date1 greater than date2.
 */
function shortFormat(num, options) {

	var numberSize = String(num).length, // Unfortunately Logs are too inaccurate - Math.round(Math.log(num) / Math.LN10)
		boundary;

	if (numberSize >= 5) { //bigger than 10,000
		boundary = Math.pow(10, numberSize) - (Math.pow(10, numberSize - 3) / 2); //e.g. 100,000 -> 9,9950 - closer to 100k than 99.9k
		if (num >= boundary) {
			numberSize++;
		}
	}

	if (numberSize >= 7) { // > 999500
		return formatNumber(num / 1000000, 2 - (numberSize - 7), options) + "m";
	}

	if (numberSize >= 5) { // > 9995 => 10.2k
		return formatNumber(num / 1000, 2 - (numberSize - 4), options) + "k";
	}

	return formatNumber(num, 0, options);
}

//-- Export section --

export default shortFormat;