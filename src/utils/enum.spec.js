import * as enumUtils from './enum';

describe('utils enum', () => {
    describe('toObject', () => {
        it('understands String Open Api Format', () => {
            const enu = enumUtils.toObject('One, Two, Three');

            expect(enu.One).toEqual(true);
            expect(enu.Two).toEqual(true);
            expect(enu.Three).toEqual(true);
        });

        it('understands String no spaces', () => {
            const enu = enumUtils.toObject('One,Two,Three');

            expect(enu.One).toEqual(true);
            expect(enu.Two).toEqual(true);
            expect(enu.Three).toEqual(true);
        });

        it('understands String tolerant', () => {
            const enu = enumUtils.toObject('One, Two   ,\n\tThree,,,');

            expect(enu.One).toEqual(true);
            expect(enu.Two).toEqual(true);
            expect(enu.Three).toEqual(true);
        });

        it('understands String Single', () => {
            const enu = enumUtils.toObject('One');

            expect(enu.One).toEqual(true);
        });

        it('understands arrays', () => {
            const enu = enumUtils.toObject(['One']);

            expect(enu.One).toEqual(true);
        });

        it('understands arrays with multiple items', () => {
            const enu = enumUtils.toObject(['One', 'Two']);

            expect(enu.One).toEqual(true);
            expect(enu.Two).toEqual(true);
        });

        it('leaves objects as-is', () => {
            const enu = enumUtils.toObject(['One', 'Two', 'Three']);
            const enu2 = enumUtils.toObject(enu);

            expect(enu).toEqual(enu2);
            expect(enu2.One).toEqual(true);
            expect(enu2.Two).toEqual(true);
            expect(enu2.Three).toEqual(true);
        });
    });

    describe('makeDefinition', () => {
        it('basically works', () => {
            const enuDefinition = enumUtils.makeDefinition(['One', 'Two', 'Three']);

            expect(enuDefinition.One).toEqual('One');
            expect(enuDefinition.Two).toEqual('Two');
            expect(enuDefinition.Three).toEqual('Three');
        });
    });

    describe('union', () => {
        it('basically works', () => {
            const union = enumUtils.union('One, Two', 'One, Three');

            expect(union.One).toBe(true);
            expect(union.Two).toBe(true);
            expect(union.Three).toBe(true);
        });
        it('with objects', () => {
            const union = enumUtils.union({ 'One': true, 'Two': true }, { 'One': true, 'Three': true });

            expect(union.One).toBe(true);
            expect(union.Two).toBe(true);
            expect(union.Three).toBe(true);
        });
    });

    describe('exclusion', () => {
        it('excludes properties present in the passed enum', () => {
            const exclusion = enumUtils.exclusion('One, Two', 'One, Three');

            expect(exclusion.Two).toBe(true);
            expect(Object.keys(exclusion).length).toBe(1);
        });

        it('remains unchanged if no common properties', () => {
            const exclusion = enumUtils.exclusion({ 'One': true, 'Two': true }, { 'Three': true, 'Four': true });

            expect(exclusion.One).toBe(true);
            expect(exclusion.Two).toBe(true);
            expect(Object.keys(exclusion).length).toBe(2);
        });

        it('becomes empty if all properties excluded', () => {
            const exclusion = enumUtils.exclusion('One, Two', 'One, Two, Three, Four');

            expect(Object.keys(exclusion).length).toBe(0);
        });
    });

    describe('toString', () => {
        it('basically works', () => {
            const enumA = enumUtils.toObject('One, Two, Three');

            expect(enumUtils.toString(enumA)).toBe('One, Two, Three');
        });
        it('handles falsy values', () => {
            const enumA = enumUtils.toObject('One, Two, Three');
            enumA.Two = false;

            expect(enumUtils.toString(enumA)).toBe('One, Three');
        });
    });
});
