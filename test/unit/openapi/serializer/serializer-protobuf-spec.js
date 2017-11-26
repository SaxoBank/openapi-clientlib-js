import * as mockProtoPrice from './../../mocks/proto-price';
import * as mockProtoMeta from './../../mocks/proto-meta';

const SerializerProtobuf = saxo.openapi._SerializerProtobuf;

describe('Serializer Protobuf', () => {

    describe('metadata', () => {
        it('should return json object with explicit null and empty', () => {
            const serializer = new SerializerProtobuf();
            const mock = mockProtoMeta.metaNulls();

            serializer.addSchema(mock.schema, 'Main', 'trade', 'v1/prices');

            const objectPayload = mock.payloadMessageNull();
            const data = serializer.parse(serializer.stringify(objectPayload, 'Main'), 'Main');

            expect(data).toEqual(jasmine.objectContaining({
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
            const serializer = new SerializerProtobuf();
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main', 'trade', 'v1/prices');

            const objectPayload = mock.payloadAll();
            const data = serializer.parse(serializer.stringify(objectPayload, 'CollectionEnvelope'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(jasmine.arrayContaining([
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
            const serializer = new SerializerProtobuf();
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main', 'trade', 'v1/prices');

            const objectPayload = mock.payloadNullMessage();
            const data = serializer.parse(serializer.stringify(objectPayload, 'CollectionEnvelope'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(jasmine.arrayContaining([
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
            const serializer = new SerializerProtobuf();
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main', 'trade', 'v1/prices');

            const objectPayload = mock.payloadEmptyLogs();
            const data = serializer.parse(serializer.stringify(objectPayload, 'CollectionEnvelope'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(jasmine.arrayContaining([
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
            const serializer = new SerializerProtobuf();
            const mock = mockProtoMeta.metaCollectionEnvelope();

            serializer.addSchema(mock.schema, 'Main', 'trade', 'v1/prices');

            const objectPayload = mock.payloadDeletedRow();
            const data = serializer.parse(serializer.stringify(objectPayload, 'CollectionEnvelope'), 'Main');

            expect(data).toBeTruthy();
            expect(data).toEqual(jasmine.arrayContaining([
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
            const serializer = new SerializerProtobuf();
            serializer.addSchema(mockProtoPrice.schemaOption, 'InstrumentPriceDetails', 'trade', 'v1/prices');
            const schemas = serializer.getSchemas();
            const rootMessage = schemas.root.getOption('saxobank_root');
            const schemaObject = serializer.getSchema(rootMessage);

            expect(schemas).not.toBeFalsy();
            expect(schemaObject.name).toBe('InstrumentPriceDetails');
            expect(rootMessage).toBe('InstrumentPriceDetails');
        });

        it('should add new price schema', () => {
            const serializer = new SerializerProtobuf();
            serializer.addSchema(mockProtoPrice.schema, 'PriceResponse', 'trade', 'v1/prices');
            const schemaObject = serializer.getSchema('PriceResponse');

            expect(schemaObject).not.toBeFalsy();
            expect(serializer.getUrlSchemaName('trade', 'v1/prices')).toBe('PriceResponse');

            expect(
                JSON.parse(JSON.stringify(schemaObject.fields))
            ).toEqual(
                jasmine.objectContaining(mockProtoPrice.fields)
            );
        });

        it('should skip adding invalid schema', () => {
            const serializer = new SerializerProtobuf();
            const done = serializer.addSchema('invalid schema: 123', 'InvalidSchema', 'trade', 'v1/prices');

            expect(done).toBe(false);
            expect(serializer.getUrlSchemaName('trade', 'v1/prices')).toBeFalsy();
            expect(serializer.getSchema('InvalidSchema')).toBeFalsy();
        });
    });

    describe('parse', () => {
        it('should parse encoded base64 price response', () => {
            const serializer = new SerializerProtobuf();
            serializer.addSchema(mockProtoPrice.schema, 'Price', 'trade', 'v1/prices');
            const price = serializer.parse(mockProtoPrice.encodedMessage);

            expect(price).toEqual(jasmine.objectContaining(mockProtoPrice.decodedObjectMessage));
        });

        it('should parse encoded base64 order response', () => {
            const serializer = new SerializerProtobuf();
            serializer.addSchema(mockProtoPrice.orderSchema, 'Order', 'portfolio', 'v1/orders');
            const objectMessage = serializer.parse(mockProtoPrice.encodedMessageOrder);

            expect(objectMessage).toBeTruthy();
        });
    });

    describe('stringify', () => {
        it('should stringify price response', () => {
            const serializer = new SerializerProtobuf();
            serializer.addSchema(mockProtoPrice.schema, 'Price', 'trade', 'v1/prices');
            const encoded = serializer.stringify(mockProtoPrice.objectMessage);

            expect(encoded).toBe(mockProtoPrice.encodedMessage);
        });
    });
});
