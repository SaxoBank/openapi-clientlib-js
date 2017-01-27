import {de_ch, da_dk, fr_fr, ar_eg, hi_in, en_us} from '../locales';

const PriceFormatting = saxo.PriceFormatting;
const priceFormatOptions = saxo.priceFormatOptions;
const extend = saxo.utils.object.extend;

function _multiply(s, count) {
	var res = "", i;
	for (i = 0; i < count; i++) {
		res = res + s;
	}
	return res;
}

var priceFormatting = new PriceFormatting(),
	priceFormatting_de_ch = new PriceFormatting(de_ch),
	priceFormatting_da_dk = new PriceFormatting(da_dk),
	priceFormatting_fr_fr = new PriceFormatting(fr_fr),
	priceFormatting_ar_eg = new PriceFormatting(ar_eg),
	priceFormatting_hi_in = new PriceFormatting(hi_in);

/* Inspired by TestFormatting.cs in client station */
describe("price-formatting format", () => {
	it("passes basic tests", () => {
		expect(priceFormatting.format(0, 1)).toEqual("0.0");
		expect(priceFormatting.format(0, 4)).toEqual("0.0000");
		expect(priceFormatting.format(0, 8)).toEqual("0.00000000");

		expect(priceFormatting.format(1.23451, 2)).toEqual("1.23");
		expect(priceFormatting.format(-1.23451, 2)).toEqual("-1.23");

		expect(priceFormatting.format(1.23451, 4)).toEqual("1.2345");
		expect(priceFormatting.format(1.23451, 5)).toEqual("1.23451");

		expect(priceFormatting.format(1234567.23451, 4)).toEqual("1,234,567.2345");
		expect(priceFormatting.format(-1234567.23451, 4)).toEqual("-1,234,567.2345");

		expect(priceFormatting.format(42, 4, priceFormatOptions.Fractions)).toEqual("42");

		expect(priceFormatting.format(42.0625, 4, priceFormatOptions.Fractions)).toEqual("42\u00a01/16");

		expect(priceFormatting.format(42.125, 5, priceFormatOptions.Fractions)).toEqual("42\u00a04/32");

		expect(priceFormatting.format(42.0625, 5, priceFormatOptions.Fractions)).toEqual("42\u00a02/32");

		expect(priceFormatting.format(-42.0625, 5, priceFormatOptions.Fractions)).toEqual("-42\u00a02/32");
	});

	it("requires decimals to be set and positive", () => {
		expect(() => priceFormatting.format(1, null)).toThrow();
		expect(() => priceFormatting.format(1, undefined)).toThrow();
		expect(() => priceFormatting.format(1, "0")).toThrow();
		expect(() => priceFormatting.format(1, -1)).toThrow();
	});

	it("can get the modern fractions character", () => {
		expect(priceFormatting.getModernFractionsSeparator()).toEqual("'");
		expect(priceFormatting_de_ch.getModernFractionsSeparator()).toEqual("\"");
	});

	it("supports fractions", () => {
		var prec, d, n, f, val, text, textadj, textwzf,
			dd, l, fraction, nn;

		for (prec = 1; prec < 9; ++prec) {
			n = Math.pow(2, prec);
			for (d = 0; d <= n; ++d) {
				f = d / n;
				if (f >= 1) {
					f -= 0.00000001;
				}
				val = 2857892.0 + f;

				text = priceFormatting.format(val, prec, priceFormatOptions.Fractions);
				textadj = priceFormatting.format(val, prec, [priceFormatOptions.AdjustFractions, priceFormatOptions.Fractions]);
				textwzf = priceFormatting.format(val, prec, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions]);

				dd = String(d);
				nn = String(n);
				l = nn.length - dd.length;

				if (d === 0) {
					fraction = dd + "/" + nn;
					expect(text).toEqual("2,857,892"); // d = 0, no options
					expect(textwzf).toEqual("2,857,892\u00a0" + fraction); // d = 0, include zero fractions

					fraction = _multiply('\u00a0', 2 * nn.length + 1);
					expect(textadj).toEqual("2,857,892\u00a0" + fraction); // d = 0, adjust fractions
				}
				else if (d < n) {
					fraction = d + "/" + n;
					expect(text).toEqual("2,857,892\u00a0" + fraction); // d < n, no options
					expect(textwzf).toEqual("2,857,892\u00a0" + fraction); // d < n, include zero fractions
					if (l > 0) {
						dd = _multiply('\u00a0', l) + dd;
						fraction = dd + "/" + nn;
					}
					expect(textadj).toEqual("2,857,892\u00a0" + fraction); // d < n, adjust fractions
				}
				else {
					fraction = 0 + "/" + n;
					expect(textwzf).toEqual("2,857,893\u00a0" + fraction); // d = n, include zero fractions
					expect(text).toEqual("2,857,893"); // d = n, no options

					fraction = _multiply('\u00a0', 2 * nn.length + 1);
					expect(textadj).toEqual("2,857,893\u00a0" + fraction); // d = n, adjust fractions
				}
			}
		}
	});

	it("Rounds up and down", () => {
		//Round down
		expect(priceFormatting.format(42.06249, 3, priceFormatOptions.Fractions)).toEqual("42");

		expect(priceFormatting.format(42.06249, 3, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions])).toEqual("42\u00a00/8");

		expect(priceFormatting.format(42.0625, 3, priceFormatOptions.Fractions)).toEqual("42\u00a01/8");

		//Round up
		expect(priceFormatting.format(42.18749, 3, priceFormatOptions.Fractions)).toEqual("42\u00a01/8");

		expect(priceFormatting.format(42.1875, 3, priceFormatOptions.Fractions)).toEqual("42\u00a02/8");

		expect(priceFormatting.format(234567.99609375, 8, priceFormatOptions.Fractions)).toEqual("234,567\u00a0255/256");

		expect(priceFormatting.format(42.9999, 3, priceFormatOptions.Fractions)).toEqual("43");

		expect(priceFormatting.format(42.9999, 3, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions])).toEqual("43\u00a00/8");

		expect(priceFormatting.format(234567.9999, 8, priceFormatOptions.Fractions)).toEqual("234,568");

		expect(priceFormatting.format(234567.9999, 8, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions])).toEqual("234,568\u00a00/256");
	});

	it("supports special futures format - 1/32", () => {
		expect(priceFormatting.format(2567.90625, 5, priceFormatOptions.ModernFractions, 0)).toEqual("2,567'29");

		//padding denominator with 0 (right adjust)
		expect(priceFormatting.format(2567.21875, 5, priceFormatOptions.ModernFractions, 0)).toEqual("2,567'07");

		expect(priceFormatting.format(2567.21875, 5, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'07.0");

		expect(priceFormatting.format(2567.21875, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'07.00");

		expect(priceFormatting.format(2567.90625, 5, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'29.0");

		expect(priceFormatting.format(2567.90625, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'29.00");

		expect(priceFormatting.format(2567.9921875, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'31.75");

		expect(priceFormatting.format(2567.0390625, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.25");

		expect(priceFormatting.format(2567.04296874, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.25");

		expect(priceFormatting.format(2567.04296875, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.50");

		expect(priceFormatting.format(2567.04296875, 5, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'01.5");

		//zero padding and digits
		expect(priceFormatting.format(0, 5, priceFormatOptions.ModernFractions)).toEqual("0'00");

		expect(priceFormatting.format(0, 5, priceFormatOptions.ModernFractions, 1)).toEqual("0'00.0");

		expect(priceFormatting.format(0, 5, priceFormatOptions.ModernFractions, 2)).toEqual("0'00.00");

		//Rounding 1240'26.3/32
		expect(priceFormatting.format(1240.821875, 5, priceFormatOptions.ModernFractions, 0)).toEqual("1,240'26"); //down

		expect(priceFormatting.format(1240.821875, 5, priceFormatOptions.ModernFractions, 2)).toEqual("1,240'26.25"); //down

		expect(priceFormatting.format(1240.821875, 5, priceFormatOptions.ModernFractions, 1)).toEqual("1,240'26.5"); //up
	});

	it("supports special futures format - 1/64", () => {
		expect(priceFormatting.format(2567.90625, 6, priceFormatOptions.ModernFractions, 0)).toEqual("2,567'58");

		//padding denominator with 0 (right adjust)
		expect(priceFormatting.format(2567.21875, 6, priceFormatOptions.ModernFractions, 0)).toEqual("2,567'14");

		expect(priceFormatting.format(2567.21875, 6, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'14.0");

		expect(priceFormatting.format(2567.21875, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'14.00");

		expect(priceFormatting.format(2567.90625, 6, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'58.0");

		expect(priceFormatting.format(2567.90625, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'58.00");

		expect(priceFormatting.format(2567.49609375, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'31.75");

		expect(priceFormatting.format(2567.01953125, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.25");

		expect(priceFormatting.format(2567.021484374, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.25");

		expect(priceFormatting.format(2567.021484375, 6, priceFormatOptions.ModernFractions, 2)).toEqual("2,567'01.50");

		expect(priceFormatting.format(2567.021484375, 6, priceFormatOptions.ModernFractions, 1)).toEqual("2,567'01.5");

		//zero padding and digits
		expect(priceFormatting.format(0, 6, priceFormatOptions.ModernFractions)).toEqual("0'00");

		expect(priceFormatting.format(0, 6, priceFormatOptions.ModernFractions, 1)).toEqual("0'00.0");

		expect(priceFormatting.format(0, 6, priceFormatOptions.ModernFractions, 2)).toEqual("0'00.00");

		//Rounding 1240'26.3/64
		expect(priceFormatting.format(1240.4109375, 6, priceFormatOptions.ModernFractions, 0)).toEqual("1,240'26"); //down

		expect(priceFormatting.format(1240.4109375, 6, priceFormatOptions.ModernFractions, 2)).toEqual("1,240'26.25"); //down

		expect(priceFormatting.format(1240.4109375, 6, priceFormatOptions.ModernFractions, 1)).toEqual("1,240'26.5"); //up
	});

	it("supports percentage", () => {
		expect(priceFormatting.format(0.1233, 2, priceFormatOptions.Percentage)).toEqual("12.33 %");

		expect(priceFormatting.format(0, 2, priceFormatOptions.Percentage)).toEqual("0.00 %");
	});

	it("supports negative numbers (for net price change)", () => {
		expect(priceFormatting.format(-102 / 128, 5, priceFormatOptions.ModernFractions, 1)).toEqual("-0'25.5");
	});

	it("supports Swiss vs. ModernFractions", () => {
		expect(priceFormatting_de_ch.format(2567.90625, 5, priceFormatOptions.ModernFractions, 2)).toEqual("2'567\"29.00");
	});

	it("supports daDK culture", () => {
		expect(priceFormatting_da_dk.format(1.23451, 2)).toEqual("1,23");

		expect(priceFormatting_da_dk.format(1.23451, 4)).toEqual("1,2345");

		expect(priceFormatting_da_dk.format(1.23451, 5)).toEqual("1,23451");

		expect(priceFormatting_da_dk.format(1234567.23451, 4)).toEqual("1.234.567,2345");

		expect(priceFormatting_da_dk.format(42.0625, 4, priceFormatOptions.Fractions)).toEqual("42\u00a01/16");

		expect(priceFormatting_da_dk.format(42.0625, 5, priceFormatOptions.Fractions)).toEqual("42\u00a02/32");
	});

	it("supports frFR culture", () => {
		expect(priceFormatting_fr_fr.format(1.23451, 2)).toEqual("1,23");

		expect(priceFormatting_fr_fr.format(1.23451, 4)).toEqual("1,2345");

		expect(priceFormatting_fr_fr.format(1.23451, 5)).toEqual("1,23451");

		expect(priceFormatting_fr_fr.format(1234567.23451, 4)).toEqual("1\u00a0234\u00a0567,2345");

		expect(priceFormatting_fr_fr.format(42.0625, 4, priceFormatOptions.Fractions)).toEqual("42\u00a01/16");

		expect(priceFormatting_fr_fr.format(42.0625, 5, priceFormatOptions.Fractions)).toEqual("42\u00a02/32");
	});

	it("supports arEG culture", () => {

		//Check - no digit substitution
		expect(priceFormatting_ar_eg.format(1.23451, 4, priceFormatOptions.Normal)).toEqual("1.2345");

		expect(priceFormatting_ar_eg.format(-1789.254, 1, priceFormatOptions.DeciPipsFraction)).toEqual("1,789.2½-");

		var parts = priceFormatting_ar_eg.formatPriceParts(-1.98760, 4);

		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("-");
	});

	it("supports hiIN culture", () => {
		expect(priceFormatting_hi_in.format(1.23451, 4)).toEqual("1.2345");

		expect(priceFormatting_hi_in.format(1234567.23451, 4)).toEqual("12,34,567.2345");
	});

	it("supports formatting with deci-pips", () => {
		expect(priceFormatting.format(1789.204, 1, priceFormatOptions.AllowDecimalPips)).toEqual("1,789.20");

		expect(priceFormatting.format(1789.204, 1, priceFormatOptions.AllowDecimalPips)).toEqual("1,789.20");

		expect(priceFormatting.format(1789.254, 1, priceFormatOptions.AllowDecimalPips)).toEqual("1,789.25");

		expect(priceFormatting.format(1789.234, 1, priceFormatOptions.AllowDecimalPips)).toEqual("1,789.23");

		expect(priceFormatting.format(1789.22049, 2, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("1,789.22.0");

		expect(priceFormatting.format(1789.22549, 2, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("1,789.22.5");

		expect(priceFormatting.format(1789.22049, 2, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1,789.22\u00a00");

		expect(priceFormatting.format(1789.22549, 2, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1,789.22\u00a05");

		expect(priceFormatting.format(46872.51, 0, priceFormatOptions.AllowDecimalPips)).toEqual("46,872.5");

		//Significant decimal separator
		expect(priceFormatting.format(46872.51, 0, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("46,872.5");

		expect(priceFormatting.format(46872.51, 0, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("46,872.5");

		expect(priceFormatting.format(1789.204, 1, priceFormatOptions.DeciPipsFraction)).toEqual("1,789.20");

		expect(priceFormatting.format(1789.254, 1, priceFormatOptions.DeciPipsFraction)).toEqual("1,789.2½");

		expect(priceFormatting.format(-1789.254, 1, priceFormatOptions.DeciPipsFraction)).toEqual("-1,789.2½");

		expect(priceFormatting.format(1789.214, 1, priceFormatOptions.DeciPipsFraction)).toEqual("1,789.21");

		expect(priceFormatting.format(1.91235, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a0½");

		expect(priceFormatting.format(1.9123049, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a00");

		expect(priceFormatting.format(1.9123749, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a07");

		expect(priceFormatting.format(1.91235, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero])).toEqual("1.9123½");

		expect(priceFormatting.format(1.9123049, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero])).toEqual("1.9123\u00a0");

		expect(priceFormatting.format(1.9123749, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero])).toEqual("1.91237");

		expect(priceFormatting.format(1.91235, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a0½");

		expect(priceFormatting.format(1.9123049, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a0\u00a0");

		expect(priceFormatting.format(1.9123749, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("1.9123\u00a07");

		//In this case the decimal separator should be ignored

		expect(priceFormatting.format(1789.22049, 2, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("1,789.220");

		expect(priceFormatting.format(1789.22549, 2, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("1,789.22½");

		//Significant decimal separator

		expect(priceFormatting.format(17893.0, 0, priceFormatOptions.DeciPipsFraction)).toEqual("17,893.0");

		expect(priceFormatting.format(17893.5, 0, priceFormatOptions.DeciPipsFraction)).toEqual("17,893½");

		expect(priceFormatting.format(17893.7, 0, priceFormatOptions.DeciPipsFraction)).toEqual("17,893.7");

		expect(priceFormatting.format(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a00");

		expect(priceFormatting.format(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a0½");

		expect(priceFormatting.format(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a07");

		expect(priceFormatting.format(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893.0");

		expect(priceFormatting.format(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893½");

		expect(priceFormatting.format(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893.7");

		expect(priceFormatting.format(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893\u00a0");

		expect(priceFormatting.format(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893½");

		expect(priceFormatting.format(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsDecimalSeparator])).toEqual("17,893.7");

		expect(priceFormatting.format(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a0\u00a0");

		expect(priceFormatting.format(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a0½");

		expect(priceFormatting.format(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator])).toEqual("17,893\u00a07");
	});

	it("supports template", () => {
		expect(priceFormatting.formatTemplated(1.98765, 4, priceFormatOptions.AllowDecimalPips)).toEqual("1.9876<small>5</small>");
		expect(priceFormatting.formatTemplated(1.98765, 5)).toEqual("1.98765<small></small>");

		expect(priceFormatting.formatTemplated(-1.98765, 4, priceFormatOptions.AllowDecimalPips, 0, "<a>{Pre}</a><b>{First}</b><c>{Pips}</c><d>{DeciPips}</d><e>{Post}</e>")).toEqual("<a>-</a><b>1.98</b><c>76</c><d>5</d><e></e>");
	});

	it("supports parts", () => {
		var parts;
		parts = priceFormatting.formatPriceParts(1.98760, 4);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98767, 4, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("7");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(-1.98765, 4, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("-");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, [priceFormatOptions.DeciPipsDecimalSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual(".5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, [priceFormatOptions.DeciPipsSpaceSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("\u00a05");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, priceFormatOptions.DeciPipsFraction);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("½");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98760, 4, priceFormatOptions.DeciPipsFraction);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("½");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98760, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("\u00a0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsSpaceSeparator]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("\u00a0½");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1.98765, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero, priceFormatOptions.DeciPipsDecimalSeparator]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1.98");
		expect(parts.Pips).toEqual("76");
		expect(parts.DeciPips).toEqual("½");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(123.560, 2, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("123.");
		expect(parts.Pips).toEqual("56");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(123.560, 2, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("123.");
		expect(parts.Pips).toEqual("56");
		expect(parts.DeciPips).toEqual("0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(123.560, 2, [priceFormatOptions.DeciPipsDecimalSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("123.");
		expect(parts.Pips).toEqual("56");
		expect(parts.DeciPips).toEqual(".0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(123.560, 2, [priceFormatOptions.DeciPipsSpaceSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("123.");
		expect(parts.Pips).toEqual("56");
		expect(parts.DeciPips).toEqual("\u00a00");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1543.10, 1, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1,54");
		expect(parts.Pips).toEqual("3.1");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1543.15, 1, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1,54");
		expect(parts.Pips).toEqual("3.1");
		expect(parts.DeciPips).toEqual("5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1543.15, 1, [priceFormatOptions.DeciPipsDecimalSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1,54");
		expect(parts.Pips).toEqual("3.1");
		expect(parts.DeciPips).toEqual(".5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(1543.15, 1, [priceFormatOptions.DeciPipsSpaceSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1,54");
		expect(parts.Pips).toEqual("3.1");
		expect(parts.DeciPips).toEqual("\u00a05");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(21091.0, 0, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("21,0");
		expect(parts.Pips).toEqual("91");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(21091.5, 0, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("21,0");
		expect(parts.Pips).toEqual("91");
		expect(parts.DeciPips).toEqual(".5");

		parts = priceFormatting.formatPriceParts(21091.5, 0, [priceFormatOptions.DeciPipsDecimalSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("21,0");
		expect(parts.Pips).toEqual("91");
		expect(parts.DeciPips).toEqual(".5");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(21091.5, 0, [priceFormatOptions.DeciPipsSpaceSeparator, priceFormatOptions.AllowDecimalPips]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("21,0");
		expect(parts.Pips).toEqual("91");
		expect(parts.DeciPips).toEqual(".5");
		expect(parts.Post).toEqual("");

		//Evil - edge cases not enough digits for pips
		parts = priceFormatting.formatPriceParts(0, 0, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(10, 0, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("10");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(10, 1, priceFormatOptions.Normal);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("1");
		expect(parts.Pips).toEqual("0.0");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(0, 0, priceFormatOptions.AllowDecimalPips);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual(".0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(0, 0, priceFormatOptions.DeciPipsFraction);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual(".0");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(0.5, 0, priceFormatOptions.DeciPipsFraction);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("½");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("\u00a0");

		parts = priceFormatting.formatPriceParts(0.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("0");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("½");
		expect(parts.Post).toEqual("");

		//Fractions
		//42.125 -> 42 1/8
		parts = priceFormatting.formatPriceParts(42.125, 3, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("\u00a01/8");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.01, 3, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.01, 3, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("\u00a00/8");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.9999, 3, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("43");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.9999, 3, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("43");
		expect(parts.Pips).toEqual("\u00a00/8");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.75, 4, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("\u00a012/16");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		//Adjusted fractions

		parts = priceFormatting.formatPriceParts(42.00390625, 8, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("\u00a01/256");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.00390625, 8, [priceFormatOptions.AdjustFractions, priceFormatOptions.Fractions]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual("\u00a0\u00a0\u00a01/256");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(42.0, 8, [priceFormatOptions.AdjustFractions, priceFormatOptions.Fractions]);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("42");
		expect(parts.Pips).toEqual(_multiply('\u00a0', 8));
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");
	});

	it("formats NaN", () => {
		var text = priceFormatting.format(NaN, 3);
		expect(text).toEqual("-");

		text = priceFormatting.format(NaN, 3, priceFormatOptions.Fractions);
		expect(text).toEqual("-");

		var parts = priceFormatting.formatPriceParts(NaN, 3, priceFormatOptions.Fractions);
		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("-");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");

		parts = priceFormatting.formatPriceParts(NaN, 6, priceFormatOptions.ModernFractions);

		expect(parts.Pre).toEqual("");
		expect(parts.First).toEqual("-");
		expect(parts.Pips).toEqual("");
		expect(parts.DeciPips).toEqual("");
		expect(parts.Post).toEqual("");
	});

	it("supports no rounding options", () => {
		var text;

		//check currently is rounding
		text = priceFormatting.format(1234.5678, 2, priceFormatOptions.Normal);
		expect(text).toEqual("1,234.57");

		text = priceFormatting.format(1234.5678, 2, priceFormatOptions.AllowDecimalPips);
		expect(text).toEqual("1,234.568");

		// and now that with no rounding it is not rounded
		text = priceFormatting.format(1234.5678, 2, [priceFormatOptions.NoRounding, priceFormatOptions.AllowDecimalPips]);
		expect(text).toEqual("1,234.5678");

		text = priceFormatting.format(1234.5678, 3, [priceFormatOptions.NoRounding, priceFormatOptions.AllowDecimalPips]);
		expect(text).toEqual("1,234.5678");

		text = priceFormatting.format(1234.5670, 3, [priceFormatOptions.NoRounding, priceFormatOptions.AllowDecimalPips]);
		expect(text).toEqual("1,234.5670");

		//Special futures - Here be dragons

		text = priceFormatting.format(2567.90625, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions]);
		expect(text).toEqual("2,567'29");

		text = priceFormatting.format(1234.5000000003, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 1);
		expect(text).toEqual("1,234'16.00000001");

		text = priceFormatting.format(1234.0, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 0);
		expect(text).toEqual("1,234'00");

		//zero padding and digits
		text = priceFormatting.format(0, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 0);
		expect(text).toEqual("0'00");

		text = priceFormatting.format(0, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 1);
		expect(text).toEqual("0'00.0");

		text = priceFormatting.format(0, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 2);
		expect(text).toEqual("0'00.00");

		text = priceFormatting.format(5000000.31250003, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 2);
		expect(text).toEqual("5,000,000'10.00000095");

		text = priceFormatting.format(1234.076771875, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 2);
		expect(text).toEqual("1,234'02.4567");

		text = priceFormatting.format(94.55499999999999, 4, priceFormatOptions.NoRounding);
		expect(text).toEqual("94.5550");

		text = priceFormatting.format(1987660.0000, 4, priceFormatOptions.NoRounding);
		expect(text).toEqual("1,987,660.0000");

		//0'01,000000000000002 = 0,0312500000000001
		text = priceFormatting.format(0.0312500000000001, 5, [priceFormatOptions.NoRounding, priceFormatOptions.ModernFractions], 2);
		expect(text).toEqual("0'01.00");
	});

	it("disallows negative decimals", () => {
		var prices = new PriceFormatting();
		expect(() => prices.format(3, -1)).toThrow();
	});
});
