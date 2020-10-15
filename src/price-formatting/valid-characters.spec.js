import { de_ch, da_dk, fr_fr } from '../test/locales';
import PriceFormatting from './price-formatting';
import priceFormatOptions from './format-options';

function testHasCharacters(
    price,
    decimals,
    formatFlags,
    options,
    includeScenarios,
) {
    const prices = new PriceFormatting(options);
    const formattedPrice = prices.format(price, decimals, formatFlags);
    const validChars = prices.getValidPriceCharacters(includeScenarios);

    for (let i = 0; i < formattedPrice.length; i++) {
        if (validChars.indexOf(formattedPrice.charAt(i)) < 0) {
            return false;
        }
    }
    return true;
}

function testRegex(price, decimals, formatFlags, options, includeScenarios) {
    const prices = new PriceFormatting(options);
    const formattedPrice = prices.format(price, decimals, formatFlags);
    const validRegex = prices.getValidPriceRegex(includeScenarios);

    return Boolean(formattedPrice.match(validRegex));
}

describe('price-formatting valid-characters', () => {
    it('support the daDk locale', () => {
        expect(
            testHasCharacters(1.23451, 2, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1.23451, 2, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(-1.23451, 2, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(false);
        expect(
            testRegex(-1.23451, 2, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(false);

        expect(
            testHasCharacters(-1.23451, 2, null, da_dk, {
                integer: false,
                negative: true,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(-1.23451, 2, null, da_dk, {
                integer: false,
                negative: true,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(1.23451, 2, null, da_dk, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(false);
        expect(
            testRegex(1.23451, 2, null, da_dk, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(false);

        expect(
            testHasCharacters(1, 0, null, da_dk, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1, 0, null, da_dk, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(1234567.23451, 4, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1234567.23451, 4, null, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(42.0625, 4, priceFormatOptions.Fractions, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(42.0625, 4, priceFormatOptions.Fractions, da_dk, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(42.0625, 4, priceFormatOptions.Fractions, da_dk, {
                integer: false,
                negative: false,
                price: false,
            }),
        ).toEqual(false);
        expect(
            testRegex(42.0625, 4, priceFormatOptions.Fractions, da_dk, {
                integer: false,
                negative: false,
                price: false,
            }),
        ).toEqual(false);
    });
    it('supports the frFR locale', () => {
        expect(
            testHasCharacters(1.23451, 2, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1.23451, 2, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(-1.23451, 2, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(false);
        expect(
            testRegex(-1.23451, 2, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(false);

        expect(
            testHasCharacters(-1.23451, 2, null, fr_fr, {
                integer: false,
                negative: true,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(-1.23451, 2, null, fr_fr, {
                integer: false,
                negative: true,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(1.23451, 2, null, fr_fr, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(false);
        expect(
            testRegex(1.23451, 2, null, fr_fr, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(false);

        expect(
            testHasCharacters(1, 0, null, fr_fr, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1, 0, null, fr_fr, {
                integer: true,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(1234567.23451, 4, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(1234567.23451, 4, null, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(42.0625, 4, priceFormatOptions.Fractions, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);
        expect(
            testRegex(42.0625, 4, priceFormatOptions.Fractions, fr_fr, {
                integer: false,
                negative: false,
                price: true,
            }),
        ).toEqual(true);

        expect(
            testHasCharacters(42.0625, 4, priceFormatOptions.Fractions, fr_fr, {
                integer: false,
                negative: false,
                price: false,
            }),
        ).toEqual(false);
        expect(
            testRegex(42.0625, 4, priceFormatOptions.Fractions, fr_fr, {
                integer: false,
                negative: false,
                price: false,
            }),
        ).toEqual(false);
    });
    it('supports the deCh locale', () => {
        expect(
            testHasCharacters(
                2567.90625,
                7,
                priceFormatOptions.ModernFractions,
                de_ch,
                { integer: false, negative: false, price: true },
            ),
        ).toEqual(true);
        expect(
            testRegex(
                2567.90625,
                7,
                priceFormatOptions.ModernFractions,
                de_ch,
                { integer: false, negative: false, price: true },
            ),
        ).toEqual(true);

        expect(
            testHasCharacters(
                2567.90625,
                7,
                priceFormatOptions.ModernFractions,
                de_ch,
                { integer: false, negative: false, price: false },
            ),
        ).toEqual(false);
        expect(
            testRegex(
                2567.90625,
                7,
                priceFormatOptions.ModernFractions,
                de_ch,
                { integer: false, negative: false, price: false },
            ),
        ).toEqual(false);
    });
});
