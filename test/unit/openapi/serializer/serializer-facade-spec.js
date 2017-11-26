const SerializerFacade = saxo.openapi._SerializerFacade;

describe('Serializer Facade', () => {
    describe('getSerializer', () => {
        it('should return json serializer', () => {
            const serializer = SerializerFacade.getSerializer('application/json', 'port', 'v1/balances');
            expect(serializer.constructor.name).toEqual('SerializerJson');
            expect(serializer.getFormatName()).toEqual('application/json');
        });

        it('should return protobuf serializer', () => {
            const serializer = SerializerFacade.getSerializer('application/x-protobuf', 'port', 'v1/balances');
            expect(serializer.constructor.name).toEqual('SerializerProtobuf');
            expect(serializer.getFormatName()).toEqual('application/x-protobuf');
        });

        it('should return default serializer', () => {
            let serializer = SerializerFacade.getSerializer('');
            expect(serializer.constructor.name).toEqual('SerializerJson');
            expect(serializer.getFormatName()).toEqual('application/json');

            serializer = SerializerFacade.getSerializer(null);
            expect(serializer.constructor.name).toEqual('SerializerJson');
            expect(serializer.getFormatName()).toEqual('application/json');

            serializer = SerializerFacade.getSerializer(undefined);
            expect(serializer.constructor.name).toEqual('SerializerJson');
            expect(serializer.getFormatName()).toEqual('application/json');
        });
    });
});
