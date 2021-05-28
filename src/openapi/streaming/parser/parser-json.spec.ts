import ParserJson from './parser-json';

describe('Parser JSON', () => {
    describe('addSchemas', () => {
        it('should try to add schema but do nothing as schemas are not supported', () => {
            let parser = new ParserJson();
            parser.addSchema('', 'Price');
            expect(parser.getSchemaType('Price', 'PriceResponse')).toBeFalsy();

            parser = new ParserJson();
            parser.addSchema('{ "random": 12 }', 'Price');
            expect(parser.getSchemaType('Price', 'PriceResponse')).toBeFalsy();
        });
    });

    describe('parse', () => {
        it('should parse encoded base64 price response', () => {
            const parser = new ParserJson();
            const payload = {
                a: 2,
                b: 3,
                c: 4,
            };

            let result = parser.parse(payload, 'PriceResponse');
            expect(result).toEqual(payload);

            result = parser.parse(payload);
            expect(result).toEqual(payload);
        });
    });

    describe('stringify', () => {
        it('should stringify price response', () => {
            const payload = {
                a: 2,
                b: 3,
                c: 4,
            };
            const parser = new ParserJson();

            let result = parser.stringify(payload, 'PriceResponse');
            expect(result).toEqual(JSON.stringify(payload));

            result = parser.stringify(payload);
            expect(result).toEqual(JSON.stringify(payload));
        });
    });
});
