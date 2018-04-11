import { en_us } from '../locales';

const NumberFormatting = saxo.NumberFormatting;

function formatNumberNoRounding(number, minDecimals, maxDecimals) {
    const numbers = new NumberFormatting();
    return numbers.formatNoRounding(number, minDecimals, maxDecimals);
}

function shortFormat(number, precision) {
    const numbers = new NumberFormatting();
    return numbers.shortFormat(number, precision);
}

function formatNumber(number, decimals, options) {
    const numbers = new NumberFormatting(options);
    return numbers.format(number, decimals);
}

describe('NumberFormatting format', () => {
    describe('no rounding', () => {
        it('basically works', () => {
            expect(formatNumberNoRounding(0, 1)).toEqual('0.0');
            expect(formatNumberNoRounding(0, 4)).toEqual('0.0000');
            expect(formatNumberNoRounding(1.1, 4)).toEqual('1.1000');
            expect(formatNumberNoRounding(1.1212, 1)).toEqual('1.1212');
            expect(formatNumberNoRounding(5e-7, 1)).toEqual('0.0000005');

            expect(formatNumberNoRounding(-1.1212, 1)).toEqual('-1.1212');
            expect(formatNumberNoRounding(-1.1, 4)).toEqual('-1.1000');
            expect(formatNumberNoRounding(-5e-7, 1)).toEqual('-0.0000005');

            expect(formatNumberNoRounding(0, 1, 2)).toEqual('0.0');
            expect(formatNumberNoRounding(0, 4, 6)).toEqual('0.0000');
            expect(formatNumberNoRounding(1.1, 4, 6)).toEqual('1.1000');
            expect(formatNumberNoRounding(1.1212, 1, 3)).toEqual('1.121');
            expect(formatNumberNoRounding(5e-7, 4, 8)).toEqual('0.0000005');

            expect(formatNumberNoRounding(-1.1212, 1, 2)).toEqual('-1.12');
            expect(formatNumberNoRounding(-1.126, 1, 2)).toEqual('-1.13');
            expect(formatNumberNoRounding(-1.1, 4, 5)).toEqual('-1.1000');
            expect(formatNumberNoRounding(-5e-7, 4, 8)).toEqual('-0.0000005');
        });
    });

    describe('short format', () => {
        it('basically works', () => {
            expect(shortFormat(1000)).toEqual('1,000');
            expect(shortFormat(9999)).toEqual('9,999');
            expect(shortFormat(10000)).toEqual('10k');
            expect(shortFormat(10049)).toEqual('10k');
            expect(shortFormat(10050)).toEqual('10.1k');
            expect(shortFormat(10940)).toEqual('10.9k');
            expect(shortFormat(19950)).toEqual('20k');
            expect(shortFormat(20049)).toEqual('20k');
            expect(shortFormat(99949)).toEqual('99.9k');
            expect(shortFormat(99950)).toEqual('100k');
            expect(shortFormat(999499)).toEqual('999k');
            expect(shortFormat(999500)).toEqual('1m');
            expect(shortFormat(1000000)).toEqual('1m');
            expect(shortFormat(1000100)).toEqual('1m');
            expect(shortFormat(1050000)).toEqual('1.05m');
            expect(shortFormat(10500000)).toEqual('10.5m');
            expect(shortFormat(105000000)).toEqual('105m');
            expect(shortFormat(1050000000)).toEqual('1,050m');
        });

        it('works with decimals', () => {
            expect(shortFormat(1.45)).toEqual('1');
            expect(shortFormat(99.4)).toEqual('99');
            expect(shortFormat(99.5)).toEqual('100');
            expect(shortFormat(100.11)).toEqual('100');
            expect(shortFormat(1000.11)).toEqual('1,000');
            expect(shortFormat(99949.11)).toEqual('99.9k');
            expect(shortFormat(100000000.11)).toEqual('100m');
        });
    });

    describe('formatNumber', () => {
        it('works for simple values', () => {
            expect(formatNumber(545750.43, 2, en_us)).toEqual('545,750.43');
            expect(formatNumber(1.756, 2, en_us)).toEqual('1.76');
            expect(formatNumber(1.45, 2, en_us)).toEqual('1.45');
            expect(formatNumber(1, 2, en_us)).toEqual('1.00');
            expect(formatNumber(5e-7, 2, en_us)).toEqual('0.00');
            expect(formatNumber(5e-7, 7, en_us)).toEqual('0.0000005');

            expect(formatNumber(545750.43, 0, en_us)).toEqual('545,750');
            expect(formatNumber(1.756, 0, en_us)).toEqual('2');
            expect(formatNumber(1.45, 0, en_us)).toEqual('1');
            expect(formatNumber(1, 0, en_us)).toEqual('1');
            expect(formatNumber(5e-7, 0, en_us)).toEqual('0');
        });
        it('works without decimals', () => {
            expect(formatNumber(545750.43)).toEqual('545,750.43');
            expect(formatNumber(545750)).toEqual('545,750');
            expect(formatNumber(545750.43893783)).toEqual('545,750.43893783');
        });
        it('handles non numbers', () => {
            expect(formatNumber(undefined, 2, en_us)).toEqual('');
            expect(formatNumber(NaN, 2, en_us)).toEqual('');
            expect(formatNumber(null, 2, en_us)).toEqual('');
            expect(formatNumber('', 2, en_us)).toEqual('');
        });
        it('uses away from zero rounding', () => {
            expect(formatNumber(-1.5, 0, en_us)).toEqual('-2');
            expect(formatNumber(-1.2, 0, en_us)).toEqual('-1');
            expect(formatNumber(-0.8, 0, en_us)).toEqual('-1');
            expect(formatNumber(-0.5, 0, en_us)).toEqual('-1');
            expect(formatNumber(-0.3, 0, en_us)).toEqual('0');
            expect(formatNumber(-5e-7, 0, en_us)).toEqual('0');
            expect(formatNumber(0, 0, en_us)).toEqual('0');
            expect(formatNumber(-0, 0, en_us)).toEqual('0');
            expect(formatNumber(5e-7, 0, en_us)).toEqual('0');
            expect(formatNumber(0.3, 0, en_us)).toEqual('0');
            expect(formatNumber(0.5, 0, en_us)).toEqual('1');
            expect(formatNumber(0.8, 0, en_us)).toEqual('1');
            expect(formatNumber(1.2, 0, en_us)).toEqual('1');
            expect(formatNumber(1.5, 0, en_us)).toEqual('2');

            expect(formatNumber(-1.15, 1, en_us)).toEqual('-1.2');
            expect(formatNumber(-1.13, 1, en_us)).toEqual('-1.1');
            expect(formatNumber(-0.05, 1, en_us)).toEqual('-0.1');
            expect(formatNumber(-0.01, 1, en_us)).toEqual('0.0');
            expect(formatNumber(1.15, 1, en_us)).toEqual('1.2');
            expect(formatNumber(1.13, 1, en_us)).toEqual('1.1');
            expect(formatNumber(0.05, 1, en_us)).toEqual('0.1');
            expect(formatNumber(0.01, 1, en_us)).toEqual('0.0');
            expect(formatNumber(5e-7, 6, en_us)).toEqual('0.000001');
            expect(formatNumber(-5e-7, 6, en_us)).toEqual('-0.000001');
        });
    });
});
