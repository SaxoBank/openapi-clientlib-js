import * as mockProtoPrice from '../../../test/mocks/proto-price';
import * as mockProtoMeta from '../../../test/mocks/proto-meta';
import protobuf from 'protobufjs/dist/protobuf';
import SerializerProtobuf from './serializer-protobuf';

describe('Serializer Protobuf', () => {

    describe('metadata', () => {
        it('should return json object with explicit null and empty', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaNulls();

            serializer.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadMessageNull();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toEqual(expect.objectContaining({
                'count': 1,
                'description': {
                    'id': 5,
                    'body': null,
                    'logs': [],
                },
                'message': null,
            }));
            expect(data.__meta_nulls).toBeFalsy();
        });

        it('should return json object with collection envelope', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadAll();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(expect.arrayContaining([
                {
                    'count': 1,
                    'key': 1,
                    'message': 'Message one.',
                },
                {
                    'count': 1,
                    'key': 2,
                    'message': 'Message two.',
                },
                {
                    'count': 1,
                    'key': 3,
                    'message': 'Message three.',
                },
            ]));
        });

        it('should return json object with collection envelope with null message', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadNullMessage();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(expect.arrayContaining([
                {
                    'count': 1,
                    'key': 1,
                    'message': 'Message one.',
                },
                {
                    'key': 2,
                    'message': null,
                },
                {
                    'count': 1,
                    'key': 3,
                    'message': 'Message three.',
                },
            ]));
        });

        it('should return json object with collection envelope with empty logs', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadEmptyLogs();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(expect.arrayContaining([
                {
                    'count': 1,
                    'key': 1,
                    'message': 'Message one.',
                },
                {
                    'key': 2,
                    'logs': [],
                },
                {
                    'count': 1,
                    'key': 3,
                    'message': 'Message three.',
                },
            ]));
        });

        it('should return json object with collection envelope with deleted row', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadDeletedRow();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(expect.arrayContaining([
                {
                    'count': 1,
                    'key': 1,
                    'message': 'Message one.',
                },
                {
                    'key': 2,
                    '__meta_deleted': true,
                },
                {
                    'count': 1,
                    'key': 3,
                    'message': 'Message three.',
                },
            ]));
        });
    });

    describe('addSchemas', () => {
        it('should check option tag for root message', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.schemaOption, 'InstrumentPriceDetails');
            const schemas = serializer.getSchema('InstrumentPriceDetails');
            const rootMessage = schemas.root.getOption('saxobank_root');
            const schemaObject = serializer.getSchemaType('InstrumentPriceDetails', rootMessage);

            expect(schemas).not.toBeFalsy();
            expect(schemaObject.name).toBe('InstrumentPriceDetails');
            expect(rootMessage).toBe('InstrumentPriceDetails');
        });

        it('should add new price schema', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.schema, 'Price');
            const schemaObject = serializer.getSchemaType('Price', 'PriceResponse');

            expect(schemaObject).not.toBeFalsy();

            expect(
                JSON.parse(JSON.stringify(schemaObject.fields))
            ).toEqual(
                expect.objectContaining(mockProtoPrice.fields)
            );
        });

        it('should skip adding invalid schema', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            const done = serializer.addSchema('invalid schema: 123', 'InvalidSchema');

            expect(done).toBe(false);
            expect(serializer.getSchemaType('InvalidSchema')).toBeFalsy();
        });
    });

    describe('parse', () => {
        it('should parse encoded base64 price response', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.schema, 'Price');
            const price = serializer.parse(mockProtoPrice.encodedMessage, 'Price');

            expect(price).toEqual(expect.objectContaining(mockProtoPrice.decodedObjectMessage));
        });

        it('should parse encoded base64 order response', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.orderSchema, 'Order');
            const objectMessage = serializer.parse(mockProtoPrice.encodedMessageOrder, 'Order');

            expect(objectMessage).toBeTruthy();
        });
    });

    describe('stringify', () => {
        it('should stringify price response', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.schema, 'Price');
            const encoded = serializer.stringify(mockProtoPrice.objectMessage, 'Price');

            expect(encoded).toBe(mockProtoPrice.encodedMessage);
        });
    });

    describe('.google.protobuf.Timestamp wrapper', () => {
        it('should return date with support for nano precision', () => {
            const serializer = new SerializerProtobuf('default', protobuf);
            serializer.addSchema(mockProtoPrice.orderSchema, 'Order');
            const objectMessage = serializer.parse(mockProtoPrice.encodedMessageOrder, 'Order');

            expect(objectMessage).toEqual(expect.arrayContaining([
                {
                    'OrderId': 'abc123',
                    'BuySell': 'buy',
                    'AccountId': 'ALGO-USD',
                    'Price': 1.3423,
                    'OrderTime': '2017-11-08T11:41:44.000Z',
                },
                {
                    'OrderId': 'xwc456',
                    'BuySell': 'sell',
                    'AccountId': 'EUR',
                    'Price': 9.123,
                    'OrderTime': '2017-11-08T11:41:44.783Z',
                },
            ]));
        });
    });
});
