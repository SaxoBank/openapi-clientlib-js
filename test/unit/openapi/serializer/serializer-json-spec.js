const SerializerJson = saxo.openapi._SerializerJson;

describe('Serializer JSON', () => {

    describe('addSchemas', () => {
        it('should try to add schema but do nothing as schemas are not supported', () => {
            let serializer = new SerializerJson();
            serializer.addSchema('', 'PriceResponse', 'trade', 'v1/prices');
            expect(serializer.getSchema('PriceResponse')).toBeFalsy();

            serializer = new SerializerJson();
            serializer.addSchema('{ "random": 12 }', 'PriceResponse', 'trade', 'v1/prices');
            expect(serializer.getSchema('PriceResponse')).toBeFalsy();
        });
    });

    describe('parse', () => {
        it('should parse encoded base64 price response', () => {
            const serializer = new SerializerJson();
            const payload = {
                a: 2,
                b: 3,
                c: 4,
            };

            let result = serializer.parse(payload, 'PriceResponse');
            expect(result).toEqual(payload);

            result = serializer.parse(payload);
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
            const serializer = new SerializerJson();

            let result = serializer.stringify(payload, 'PriceResponse');
            expect(result).toEqual(JSON.stringify(payload));

            result = serializer.stringify(payload);
            expect(result).toEqual(JSON.stringify(payload));
        });
    });
});
