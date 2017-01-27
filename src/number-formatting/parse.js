/**
 * @module saxo/number-formatting/parse
 * @ignore
 */

import { endsWith, startsWith } from '../utils/string';

//-- Local variables section --

const NO_BREAK_SPACE_REGEX = /\u00A0/g;

//-- Local methods section --

function parseNumberNegativePattern(value, options, tryFallback) {

	var pre = options.negativePre.replace(NO_BREAK_SPACE_REGEX, " ");
	var post = options.negativePost.replace(NO_BREAK_SPACE_REGEX, " ");
	value = value.replace(NO_BREAK_SPACE_REGEX, " ");

	if (startsWith(value, pre) && endsWith(value, post)) {
		return ["-", value.substr(pre.length, value.length - (pre.length + post.length))];
	}

	if (tryFallback && startsWith(value, "-")) {
		return ["-", value.substr(1)];
	}

	return ["", value];
}

//-- Exported methods section --

function parseNumber(value, options) {

	if (value == null) {
		return NaN;
	}

	value = value.trim();

	var signInfo = parseNumberNegativePattern(value, options, true);
	var sign = signInfo[0];
	var num = signInfo[1];
	if (sign === "") {
		sign = "+";
	}

	var exponent;
	var intAndFraction;
	var exponentPos = num.indexOf("e");
	if (exponentPos < 0) {
		exponentPos = num.indexOf("E");
	}
	if (exponentPos < 0) {
		intAndFraction = num;
		exponent = null;
	} else {
		intAndFraction = num.substr(0, exponentPos);
		exponent = num.substr(exponentPos + 1);
	}
	var integer;
	var fraction;
	var decimalPos = intAndFraction.indexOf(options.decimalSeparator);
	if (decimalPos < 0) {
		integer = intAndFraction;
		fraction = null;
	} else {
		integer = intAndFraction.substr(0, decimalPos);
		fraction = intAndFraction.substr(decimalPos + options.decimalSeparator.length);
	}
	integer = integer.split(options.groupSeparator).join("");
	var altNumGroupSeparator = options.groupSeparator.replace(NO_BREAK_SPACE_REGEX, " ");
	if (options.groupSeparator !== altNumGroupSeparator) {
		integer = integer.split(altNumGroupSeparator).join("");
	}
	var p = sign + integer;
	if (fraction !== null) {
		p += "." + fraction;
	}
	if (exponent !== null) {
		var expSignInfo = parseNumberNegativePattern(exponent, options);
		if (expSignInfo[0] === "") {
			expSignInfo[0] = "+";
		}
		p += "e" + expSignInfo[0] + expSignInfo[1];
	}
	if (p.match(/^[+\-]?\d*\.?\d*(e[+\-]?\d+)?$/)) {
		return parseFloat(p);
	}
	return NaN;
}

//-- Export section --

export default parseNumber;
