import { en_us, ar_eg } from '../test/locales';
import NumberFormatting from '.';
import type { NumberFormattingOptions } from '.';

function formatNumberNoRounding(
    number: number | string | null | undefined,
    minDecimals?: number,
    maxDecimals?: number,
) {
    const numbers = new NumberFormatting();
    return numbers.formatNoRounding(number, minDecimals, maxDecimals);
}

function shortFormat(
    number: number | undefined | null | string,
    options?: Partial<NumberFormattingOptions>,
) {
    const numbers = new NumberFormatting(options);
    return numbers.shortFormat(number);
}

function formatNumber(
    number: number | null | undefined | string,
    decimals?: number | null,
    options?: Partial<NumberFormattingOptions>,
) {
    const numbers = new NumberFormatting(options);
    return numbers.format(number, decimals);
}
function getActualDecimals(number: number) {
    const numbers = new NumberFormatting();
    return numbers.getActualDecimals(number);
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

        it('handles large numeric value', () => {
            expect(formatNumberNoRounding(92893282191.78, 2)).toEqual(
                '92,893,282,191.78',
            );
            expect(formatNumberNoRounding(12345678912345.6, 4)).toEqual(
                '12,345,678,912,345.6000',
            );
            expect(formatNumberNoRounding(12345678912.3456, 1, 3)).toEqual(
                '12,345,678,912.346',
            );
        });
        it('handles numeric strings', () => {
            expect(formatNumberNoRounding('1.1', 4)).toEqual('1.1000');
            expect(formatNumberNoRounding('1.1212', 1)).toEqual('1.1212');
        });
        it('returns empty string for invalid number', () => {
            expect(formatNumberNoRounding(undefined, 1)).toEqual('');
            expect(formatNumberNoRounding(null, 1, 2)).toEqual('');
            expect(formatNumberNoRounding('foo', 1, 5)).toEqual('');
        });
    });

    describe('short format', () => {
        it('basically works', () => {
            expect(shortFormat(1000)).toEqual('1,000');
            expect(shortFormat(-1000)).toEqual('-1,000');
            expect(shortFormat(-1000, ar_eg)).toEqual('1,000-');
            expect(shortFormat(9999)).toEqual('9,999');
            expect(shortFormat(-9999)).toEqual('-9,999');
            expect(shortFormat(-9999, ar_eg)).toEqual('9,999-');
            expect(shortFormat(10000)).toEqual('10k');
            expect(shortFormat(-10000)).toEqual('-10k');
            expect(shortFormat(-10000, ar_eg)).toEqual('10-k');
            expect(shortFormat(10049)).toEqual('10k');
            expect(shortFormat(10050)).toEqual('10.1k');
            expect(shortFormat(10940)).toEqual('10.9k');
            expect(shortFormat(19950)).toEqual('20k');
            expect(shortFormat(20049)).toEqual('20k');
            expect(shortFormat(99949)).toEqual('99.9k');
            expect(shortFormat(99950)).toEqual('100k');
            expect(shortFormat(-99950)).toEqual('-100k');
            expect(shortFormat(-99950, ar_eg)).toEqual('100-k');
            expect(shortFormat(-100000)).toEqual('-100k');
            expect(shortFormat(999499)).toEqual('999k');
            expect(shortFormat(999500)).toEqual('1m');
            expect(shortFormat(-999500)).toEqual('-1m');
            expect(shortFormat(-999500, ar_eg)).toEqual('1-m');
            expect(shortFormat(1000000)).toEqual('1m');
            expect(shortFormat(-1000000)).toEqual('-1m');
            expect(shortFormat(-1000000, ar_eg)).toEqual('1-m');
            expect(shortFormat(1000100)).toEqual('1m');
            expect(shortFormat(1050000)).toEqual('1.05m');
            expect(shortFormat(10500000)).toEqual('10.5m');
            expect(shortFormat(105000000)).toEqual('105m');
            expect(shortFormat(999500000)).toEqual('1bn');
            expect(shortFormat(-999500000)).toEqual('-1bn');
            expect(shortFormat(-999500000, ar_eg)).toEqual('1-bn');
            expect(shortFormat(1000000000)).toEqual('1bn');
            expect(shortFormat(-1000000000)).toEqual('-1bn');
            expect(shortFormat(-1000000000, ar_eg)).toEqual('1-bn');
            expect(shortFormat(1000100000)).toEqual('1bn');
            expect(shortFormat(1050000000)).toEqual('1.05bn');
            expect(shortFormat(10500000000)).toEqual('10.5bn');
            expect(shortFormat(105000000000)).toEqual('105bn');
            expect(shortFormat(1050000000)).toEqual('1.05bn');
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

        it('accepts localization options', () => {
            expect(shortFormat(10000, { unitSuffixThousand: ' thou' })).toEqual(
                '10 thou',
            );
            expect(shortFormat(100000000, { unitSuffixMillion: 'Mi' })).toEqual(
                '100Mi',
            );
            expect(
                shortFormat(1000000000, { unitSuffixBillion: 'Bn' }),
            ).toEqual('1Bn');
        });

        it('returns an empty string for null or undefined or not numeric strings', () => {
            expect(shortFormat(null)).toBe('');
            expect(shortFormat(undefined)).toBe('');
        });

        it('returns proper value for numeric strings', () => {
            expect(shortFormat('100000000.11')).toBe('100m');
            expect(shortFormat('999500000')).toBe('1bn');
            expect(shortFormat('999500000', { unitSuffixBillion: 'Bn' })).toBe(
                '1Bn',
            );
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
            expect(formatNumber(undefined)).toEqual('');
            expect(formatNumber(null)).toEqual('');
            expect(formatNumber(NaN, 2, en_us)).toEqual('');
            expect(formatNumber(null, 2, en_us)).toEqual('');
            expect(formatNumber('', 2, en_us)).toEqual('');
            expect(formatNumber('string', 2, en_us)).toEqual('');
            expect(formatNumber('string')).toEqual('');
        });
        it('handles numeric strings properly', () => {
            expect(formatNumber('1.3')).toEqual('1.3');
            expect(formatNumber('2.5', 2)).toEqual('2.50');
            expect(formatNumber('2.4', 0)).toEqual('2');
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
    describe('getActualDecimals', () => {
        it('returns proper number of decimals', () => {
            expect(getActualDecimals(545750.43)).toEqual(2);
            expect(getActualDecimals(1.756)).toEqual(3);
            expect(getActualDecimals(1)).toEqual(0);
            expect(getActualDecimals(0)).toEqual(0);
            expect(getActualDecimals(0)).toEqual(0);
        });
    });
});
