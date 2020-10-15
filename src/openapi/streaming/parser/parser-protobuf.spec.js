import protobuf from 'protobufjs/dist/protobuf';
import * as mockProtoPrice from '../../../test/mocks/proto-price';
import * as mockProtoMeta from '../../../test/mocks/proto-meta';
import ParserProtobuf from './parser-protobuf';

describe('Parser Protobuf', () => {
    describe('metadata', () => {
        it('should return json object with explicit null and empty', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaNulls();

            parser.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadMessageNull();
            const data = parser.parse(
                parser.stringify(objectPayload, 'Main'),
                'Main',
            );

            expect(data).toEqual(
                expect.objectContaining({
                    count: 1,
                    description: {
                        id: 5,
                        body: null,
                        logs: [],
                    },
                    message: null,
                }),
            );
            expect(data.__meta_nulls).toBeFalsy();
        });

        it('should return json object with collection envelope', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            parser.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadAll();
            const data = parser.parse(
                parser.stringify(objectPayload, 'Main'),
                'Main',
            );

            expect(data).toBeTruthy();
            expect(data).toEqual(
                expect.arrayContaining([
                    {
                        count: 1,
                        key: 1,
                        message: 'Message one.',
                    },
                    {
                        count: 1,
                        key: 2,
                        message: 'Message two.',
                    },
                    {
                        count: 1,
                        key: 3,
                        message: 'Message three.',
                    },
                ]),
            );
        });

        it('should return json object with collection envelope with null message', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            parser.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadNullMessage();
            const data = parser.parse(
                parser.stringify(objectPayload, 'Main'),
                'Main',
            );

            expect(data).toBeTruthy();
            expect(data).toEqual(
                expect.arrayContaining([
                    {
                        count: 1,
                        key: 1,
                        message: 'Message one.',
                    },
                    {
                        key: 2,
                        message: null,
                    },
                    {
                        count: 1,
                        key: 3,
                        message: 'Message three.',
                    },
                ]),
            );
        });

        it('should return json object with collection envelope with empty logs', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            parser.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadEmptyLogs();
            const data = parser.parse(
                parser.stringify(objectPayload, 'Main'),
                'Main',
            );

            expect(data).toBeTruthy();
            expect(data).toEqual(
                expect.arrayContaining([
                    {
                        count: 1,
                        key: 1,
                        message: 'Message one.',
                    },
                    {
                        key: 2,
                        logs: [],
                    },
                    {
                        count: 1,
                        key: 3,
                        message: 'Message three.',
                    },
                ]),
            );
        });

        it('should return json object with collection envelope with deleted row', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const mock = mockProtoMeta.metaCollectionEnvelope();

            parser.addSchema(mock.schema, 'Main');

            const objectPayload = mock.payloadDeletedRow();
            const data = parser.parse(
                parser.stringify(objectPayload, 'Main'),
                'Main',
            );

            expect(data).toBeTruthy();
            expect(data).toEqual(
                expect.arrayContaining([
                    {
                        count: 1,
                        key: 1,
                        message: 'Message one.',
                    },
                    {
                        key: 2,
                        __meta_deleted: true,
                    },
                    {
                        count: 1,
                        key: 3,
                        message: 'Message three.',
                    },
                ]),
            );
        });
    });

    describe('addSchemas', () => {
        it('should check option tag for root message', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(
                mockProtoPrice.schemaOption,
                'InstrumentPriceDetails',
            );
            const schemas = parser.getSchema('InstrumentPriceDetails');
            const rootMessage = schemas.root.getOption('saxobank_root');
            const schemaObject = parser.getSchemaType(
                'InstrumentPriceDetails',
                rootMessage,
            );

            expect(schemas).not.toBeFalsy();
            expect(schemaObject.name).toBe('InstrumentPriceDetails');
            expect(rootMessage).toBe('InstrumentPriceDetails');
        });

        it('should add new price schema', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(mockProtoPrice.schema, 'Price');
            const schemaObject = parser.getSchemaType('Price', 'PriceResponse');

            expect(schemaObject).not.toBeFalsy();

            expect(JSON.parse(JSON.stringify(schemaObject.fields))).toEqual(
                expect.objectContaining(mockProtoPrice.fields),
            );
        });

        it('should skip adding invalid schema', () => {
            const parser = new ParserProtobuf('default', protobuf);
            const done = parser.addSchema(
                'invalid schema: 123',
                'InvalidSchema',
            );

            expect(done).toBe(false);
            expect(parser.getSchemaType('InvalidSchema')).toBeFalsy();
        });
    });

    describe('parse', () => {
        it('should parse encoded base64 price response', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(mockProtoPrice.schema, 'Price');
            const price = parser.parse(mockProtoPrice.encodedMessage, 'Price');

            expect(price).toEqual(
                expect.objectContaining(mockProtoPrice.decodedObjectMessage),
            );
        });

        it('should parse encoded base64 order response', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(mockProtoPrice.orderSchema, 'Order');
            const objectMessage = parser.parse(
                mockProtoPrice.encodedMessageOrder,
                'Order',
            );

            expect(objectMessage).toBeTruthy();
        });
    });

    describe('stringify', () => {
        it('should stringify price response', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(mockProtoPrice.schema, 'Price');
            const encoded = parser.stringify(
                mockProtoPrice.objectMessage,
                'Price',
            );

            expect(encoded).toBe(mockProtoPrice.encodedMessage);
        });
    });

    describe('.google.protobuf.Timestamp wrapper', () => {
        it('should return date with support for nano precision', () => {
            const parser = new ParserProtobuf('default', protobuf);
            parser.addSchema(mockProtoPrice.orderSchema, 'Order');
            const objectMessage = parser.parse(
                mockProtoPrice.encodedMessageOrder,
                'Order',
            );

            expect(objectMessage).toEqual(
                expect.arrayContaining([
                    {
                        OrderId: 'abc123',
                        BuySell: 'buy',
                        AccountId: 'ALGO-USD',
                        Price: 1.3423,
                        OrderTime: '2017-11-08T11:41:44.000Z',
                    },
                    {
                        OrderId: 'xwc456',
                        BuySell: 'sell',
                        AccountId: 'EUR',
                        Price: 9.123,
                        OrderTime: '2017-11-08T11:41:44.783Z',
                    },
                ]),
            );
        });
    });
});
