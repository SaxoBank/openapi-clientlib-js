import protobuf from 'protobufjs/dist/protobuf';
import SerializerFacade from './serializer-facade';
import SerializerProtobuf from './serializer-protobuf';

SerializerFacade.addEngines({
    'application/x-protobuf': protobuf,
});

SerializerFacade.addSerializers({
    'application/x-protobuf': SerializerProtobuf,
});

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
