import NumberFormatting from '.';

function parse(number: string) {
    const numbers = new NumberFormatting();
    return numbers.parse(number);
}

describe('NumberFormatting parse', () => {
    it('basically works', () => {
        expect(parse('1.2')).toEqual(1.2);
        expect(parse('100,000')).toEqual(100000);
    });

    it('handles bad input', () => {
        // @ts-expect-error
        expect(parse(null)).toEqual(NaN);
        // @ts-expect-error
        expect(parse(undefined)).toEqual(NaN);
    });
});
