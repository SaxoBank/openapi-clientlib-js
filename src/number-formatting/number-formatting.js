/**
 * @module saxo/number-formatting/number-formatting
 * @ignore
 */

import formatNumber  from './format';
import parseNumber from './parse';
import shortFormat from './short-format';
import {extend} from '../utils/object';

//-- Local variables section --

var defaultOptions = {
	groupSizes: [3],
	groupSeparator: ',',
	decimalSeparator: '.',
	negativePattern: '-{0}'
};

var numberOfZerosRx = /0+$/;

//-- Local methods section --

//-- Exported methods section --

/**
 * A class which does number formatting and parsing.
 * @class
 * @alias saxo.NumberFormatting
 * @param {Object} [options] - Number locale options.
 * @param {Array.<number>} [options.groupSizes=[3]] - The group sizes for the number. E.g. [3] would be thousands seperator and produce 123.456.789,00 where as [2,3] would be "12.34.56.789,00".
 * @param {string} [options.groupSeparator=","] - The character used for group separation E.g. '.' in Danish.
 * @param {string} [options.decimalSeparator="."] - The character used for decimal searation E.g.',' in Danish.
 * @param {string} [options.negativePattern="-{0}"] - The negative pattern to use with '{0}' as the placeholder for the non-negative number.
 */
function NumberFormatting(options) {
	extend(this, defaultOptions, options);

	this.negativePre = this.negativePattern.substr(0, this.negativePattern.indexOf('{'));
	this.negativePost = this.negativePattern.substr(this.negativePattern.indexOf('}') + 1);
}

/**
 * Parses a localised string into a number.
 * @param {string} value - The number to parse.
 * @returns {number} parsed value
 */
NumberFormatting.prototype.parse = function(value) {
	return parseNumber(value, this);
};

/**
 * Formats a number into a localised string.
 * @param {number} num - The number to format.
 * @param {number} [decimals] - The number of decimals to display after the decimal point. 
 *                              If undefined then the number is formatted with however many decimal places it needs to display the number (upto 8).
 * @returns {string}
 */
NumberFormatting.prototype.format = function(num, decimals) {
	if (decimals === undefined || decimals === null) {
		decimals = this.getActualDecimals(num);
	}

	return formatNumber(num, decimals, this);
};

/**
 * Formats the number without rounding. e.g. 1.12 formatted with 1 decimal place is "1.12".
 * @param {number} num - The number to format
 * @param {number} [minDecimals] - The minimum number of decimals to display after the decimal point.
 * @param {number} [maxDecimals] - The maximum number of decimals to display after the decimal point.
 * @returns {string}
 */
NumberFormatting.prototype.formatNoRounding = function(num, minDecimals, maxDecimals) {
	if (!minDecimals) { minDecimals = 0; }
	if (!maxDecimals) { maxDecimals = 8; }

	return formatNumber(num,
		Math.min(maxDecimals, Math.max(minDecimals, this.getActualDecimals(num))),
		this);
};

/**
 * Formats a number into a short format, e.g. 10.000 becomes 10k.
 * @param {number} number
 * @returns {string}
 */
NumberFormatting.prototype.shortFormat = function(number) {
	return shortFormat(number, this);
};

/**
 * Returns the actual number of decimals that a number has.
 * @param number
 * @returns {number}
 */
NumberFormatting.prototype.getActualDecimals = function (number) {
	number = Math.abs(number);
	return (number - Math.floor(number)).toFixed(8).substring(2, 10).replace(numberOfZerosRx, "").length;
};

//-- Export section --

export default NumberFormatting;
