import { de_ch, da_dk, fr_fr, ar_eg, hi_in } from '../locales';

const PriceFormatting = saxo.PriceFormatting;
const priceFormatOptions = saxo.priceFormatOptions;

function testConversion(value, decimals, priceFormatOption, numeratorDecimals, options) {
    if (options != null) {
        expect(typeof options).toEqual('object');
    }
    const prices = new PriceFormatting(options);
    expect(prices.parse(prices.format(value, decimals, priceFormatOption, numeratorDecimals), decimals, priceFormatOption)).toEqual(value);
}

function testConversionChanged(value, newValue, decimals, priceFormatOption, options) {
    const prices = new PriceFormatting(options);
    expect(prices.parse(prices.format(value, decimals, priceFormatOption), decimals, priceFormatOption)).toEqual(newValue);
}

describe('price-formatting parse', () => {
    it('does the basics', function() {

        testConversion(0, 1);
        testConversion(0, 4);
        testConversion(0, 8);

        testConversionChanged(1.23451, 1.23, 2);
        testConversionChanged(-1.23451, -1.23, 2);

        testConversionChanged(1.23451, 1.2345, 4);
        testConversion(1.23451, 5);

        testConversionChanged(1234567.23451, 1234567.2345, 4);
        testConversionChanged(-1234567.23451, -1234567.2345, 4);

        testConversion(42, 4, priceFormatOptions.Fractions);

        testConversion(42.0625, 4, priceFormatOptions.Fractions);

        testConversion(42.125, 5, priceFormatOptions.Fractions);

        testConversion(42.0625, 5, priceFormatOptions.Fractions);

        testConversion(-42.0625, 5, priceFormatOptions.Fractions);

        testConversion(42, 3, [priceFormatOptions.IncludeZeroFractions, priceFormatOptions.Fractions]);
    });

    it('handles Special Futures Format - 32', function() {

        testConversion(2567.90625, 5, priceFormatOptions.ModernFractions);

        testConversion(2567.21875, 5, priceFormatOptions.ModernFractions);

        testConversion(2567.21875, 5, priceFormatOptions.ModernFractions, 1);

        testConversion(2567.21875, 5, priceFormatOptions.ModernFractions, 2);

        testConversion(2567.90625, 5, priceFormatOptions.ModernFractions, 1);

        testConversion(2567.90625, 5, priceFormatOptions.ModernFractions, 2);

        testConversion(2567.9921875, 5, priceFormatOptions.ModernFractions, 2);

        testConversion(2567.0390625, 5, priceFormatOptions.ModernFractions, 2);

        // zero padding and digits
        testConversion(0, 5, priceFormatOptions.ModernFractions);

        testConversion(0, 5, priceFormatOptions.ModernFractions, 1);

        testConversion(0, 5, priceFormatOptions.ModernFractions, 2);

        testConversion(-0.5625, 5, priceFormatOptions.ModernFractions);
    });

    it('handles Special Futures Format - 64', function() {

        testConversion(2567.21875, 6, priceFormatOptions.ModernFractions);

        testConversion(2567.21875, 6, priceFormatOptions.ModernFractions, 1);

        testConversion(2567.21875, 6, priceFormatOptions.ModernFractions, 2);

        testConversion(2567.4921875, 6, priceFormatOptions.ModernFractions, 1);

        testConversion(2567.4921875, 6, priceFormatOptions.ModernFractions, 2);

        testConversion(2567.49609375, 6, priceFormatOptions.ModernFractions, 2);

        // zero padding and digits
        testConversion(0, 6, priceFormatOptions.ModernFractions);

        testConversion(0, 6, priceFormatOptions.ModernFractions, 1);

        testConversion(0, 6, priceFormatOptions.ModernFractions, 2);
    });

    it('handles invalid Special Futures Format values', function() {
        const prices = new PriceFormatting();

        expect(prices.parse('0\'', 6, priceFormatOptions.ModernFractions)).toEqual(0);
        expect(prices.parse('\'', 6, priceFormatOptions.ModernFractions)).toEqual(0);
        expect(prices.parse('\'0', 6, priceFormatOptions.ModernFractions)).toEqual(0);
        expect(prices.parse('abc', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('abc\'', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('abc\'0', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('0\'abc', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('\'abc', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('abc\'abc', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('0\'99', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
    });

    it('handles misc scenarios', function() {
        // Percentage
        testConversion(0.1233, 2, priceFormatOptions.Percentage);

        testConversion(0, 2, priceFormatOptions.Percentage);

        // Swiss vs. ModernFractions
        testConversion(2567.90625, 5, priceFormatOptions.ModernFractions, 2, de_ch);
    });

    it('handles daDK', function() {

        testConversion(1.23451, 5, null, 0, da_dk);

        testConversion(1234567.2345, 4, null, 0, da_dk);

        testConversion(42.0625, 4, priceFormatOptions.Fractions, 0, da_dk);

        testConversion(42.0625, 5, priceFormatOptions.Fractions, 0, da_dk);
    });

    it('handles frFR', function() {
        testConversion(1.23451, 5, null, 0, fr_fr);

        testConversion(1234567.2345, 4, null, 0, fr_fr);

        testConversion(42.0625, 4, priceFormatOptions.Fractions, 0, fr_fr);

        testConversion(42.0625, 5, priceFormatOptions.Fractions, 0, fr_fr);
    });

    it('handles arEG', function() {
        testConversion(1.2345, 4, priceFormatOptions.Normal, 0, ar_eg);
    });

    it('handles hiIN', function() {
        testConversion(1.2345, 4, null, 0, hi_in);

        testConversion(1234567.2345, 4, null, 0, hi_in);
    });

    it('supports format with deci-pips', function() {
        testConversion(1789.2, 1, priceFormatOptions.AllowDecimalPips);

        testConversion(1789.25, 1, priceFormatOptions.AllowDecimalPips);

        testConversion(46872, 0, priceFormatOptions.AllowDecimalPips);
    });

    it('supports vulgar functions', () => {
        const prices = new PriceFormatting();

        expect(prices.parse('2\u00BC', 2, priceFormatOptions.Fractions)).toEqual(2.25);
        expect(prices.parse('1 \u00BD ', 2, priceFormatOptions.Fractions)).toEqual(1.5);
        expect(prices.parse('100 \u215E ', 2, priceFormatOptions.Fractions)).toEqual(100 + 7 / 8);
    });

    it('disallows negative decimals', () => {
        const prices = new PriceFormatting();
        expect(() => prices.parse('3', -1)).toThrow();
    });

    it('handles bad input', () => {
        const prices = new PriceFormatting();

        expect(prices.parse(null)).toEqual(NaN);
        expect(prices.parse(undefined)).toEqual(NaN);
        expect(prices.parse('')).toEqual(NaN);
        expect(prices.parse('abc')).toEqual(NaN);

        expect(prices.parse(null, 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse(undefined), 6, priceFormatOptions.ModernFractions).toEqual(NaN);
        expect(prices.parse('', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);
        expect(prices.parse('abc', 6, priceFormatOptions.ModernFractions)).toEqual(NaN);

        expect(prices.parse(null, 6, priceFormatOptions.Fractions)).toEqual(NaN);
        expect(prices.parse(undefined), 6, priceFormatOptions.Fractions).toEqual(NaN);
        expect(prices.parse('', 6, priceFormatOptions.Fractions)).toEqual(NaN);
        expect(prices.parse('abc', 6, priceFormatOptions.Fractions)).toEqual(NaN);
    });

/*

    The below tests flags that are not implemented at the moment

    it("handles unsupported format with deci-pips", function () {
        testConversion(-1789.254, 1, priceFormatOptions.DeciPipsFraction, ar_eg);

        testConversion(1789.22, 2, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsDecimalSeparator]);

        //Significant decimal separator
        testConversion(46872.5, 0, [priceFormatOptions.AllowDecimalPips, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1789.20, 1, priceFormatOptions.DeciPipsFraction);

        testConversion(1789.25, 1, priceFormatOptions.DeciPipsFraction);

        testConversion(-1789.254, 1, priceFormatOptions.DeciPipsFraction);

        testConversion(1789.214, 1, priceFormatOptions.DeciPipsFraction);

        testConversion(1.91235, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1.9123049, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1.9123749, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1.91235, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);

        testConversion(1.9123049, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);

        testConversion(1.9123749, 4, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceForZero]);

        testConversion(1.91235, 4, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1.9123049, 4, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(1.9123749, 4, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);

        //In this case the decimal separator should be ignored

        testConversion(1789.22049, 2, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(1789.22549, 2, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator]);

        //Significant decimal separator

        testConversion(17893.0, 0, priceFormatOptions.DeciPipsFraction);

        testConversion(17893.5, 0, priceFormatOptions.DeciPipsFraction);

        testConversion(17893.7, 0, priceFormatOptions.DeciPipsFraction);

        testConversion(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(17893.0, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.5, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.7, 0, [priceFormatOptions.DeciPipsFraction, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.0, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.5, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.7, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsDecimalSeparator]);

        testConversion(17893.0, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(17893.5, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);

        testConversion(17893.7, 0, [priceFormatOptions.DeciPipsFractionOrSpace, priceFormatOptions.DeciPipsSpaceSeparator]);
    });*/
});
