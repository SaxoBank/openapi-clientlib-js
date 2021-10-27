import log from '../../../log';
import ParserBase from './parser-base';
import MetaProcessor from './meta/meta-protobuf';
import wrappers from './wrappers/protobuf-wrappers';
import type * as ProtoBuf from 'protobufjs';

const LOG_AREA = 'ParserProtobuf';

const ROOT_OPTION_NAME = 'saxobank_root';

type ProtoBufEngine = typeof ProtoBuf;

/**
 * Protobuf Parser.
 */
class ParserProtobuf extends ParserBase {
    static FORMAT_NAME = 'application/x-protobuf';

    name: string;
    protobuf: ProtoBufEngine;
    schemasMap: Record<string, ProtoBuf.IParserResult> = {};
    schemasSourceMap: Record<string, string> = {};
    lastSchemaName: string | null = null;
    metaProcessor: MetaProcessor;

    constructor(name: string, engine: ProtoBufEngine) {
        super();
        this.name = name;

        // Parsing engine, currently only supported implementation is: https://github.com/dcodeIO/ProtoBuf.js
        this.protobuf = engine;

        wrappers.register(this.protobuf.wrappers);

        /**
         * Processing of supported meta fields of decoded message type.
         */
        this.metaProcessor = new MetaProcessor();
    }

    /**
     * Create root schema and register custom wrappers to support JS types. ie. casting Google.Timestamp to JS Date.
     *
     */
    private createRootSchema() {
        let schemas = this.protobuf.Root.fromJSON(
            this.protobuf.common.get(
                'google/protobuf/wrappers.proto',
            ) as ProtoBuf.INamespace,
            // @ts-expect-error - TS says that the root prop does not exists - verify why it's used like that
            this.protobuf.root,
        );
        schemas = this.protobuf.Root.fromJSON(
            this.protobuf.common.get(
                'google/protobuf/timestamp.proto',
            ) as ProtoBuf.INamespace,
            schemas,
        );
        return schemas;
    }

    getSchemaType(schemaName: string, typeName: string) {
        const schemas = this.schemasMap[schemaName];
        return schemas?.root.lookup(typeName) as
            | ProtoBuf.Type
            | null
            | undefined;
    }
    getSchemaName() {
        return this.lastSchemaName;
    }
    getSchema(name: string) {
        return this.schemasMap[name];
    }
    getSchemaNames() {
        return Object.keys(this.schemasMap);
    }

    /**
     * Parses and adds schema to local schema map.
     * @param schemaData - The schema data, not parsed, in raw, string format.
     * @param name - The schema name, under which it will be saved in schema map.
     * @returns Returns true if there were no issues, false otherwise.
     */
    addSchema(schemaData: string, name: string) {
        if (this.schemasMap[name]) {
            // Schemas for this name already exist.
            return true;
        }

        const rootSchema = this.createRootSchema();
        let schema: ProtoBuf.IParserResult;
        try {
            schema = this.protobuf.parse(schemaData, rootSchema.root, {
                keepCase: true,
            });
        } catch (error) {
            log.error(LOG_AREA, 'Schema parsing failed', {
                error,
                name,
                schemaData,
            });

            throw new Error('Protobuf schema parsing failed');
        }

        this.schemasSourceMap[name] = schemaData;
        this.schemasMap[name] = schema;
        this.lastSchemaName = name;
        return true;
    }

    /**
     * Parse data using given schema. Data should be in base64 format.
     * @param data - The data to parse. Data should be in base64 format.
     * @param schemaName - The name of a schema to be used for parsing.
     * @returns Result of parsing, if successful. Returns null if parsing fails or there is no data.
     */
    parse(data: string | Uint8Array | null | undefined, schemaName: string) {
        if (!data) {
            return null;
        }

        const schemas = this.getSchema(schemaName);

        if (!schemas) {
            log.error(
                LOG_AREA,
                'Protobuf parsing failed - failed to get schemas',
                {
                    schemaName,
                },
            );
            throw new Error('Protobuf parsing failed - failed to get schemas');
        }

        const rootTypeName = schemas.root.getOption(ROOT_OPTION_NAME);

        if (!rootTypeName) {
            log.error(
                LOG_AREA,
                'Protobuf parsing failed - missing root type name',
                { schemaName },
            );
            throw new Error('Protobuf parsing failed - missing root type name');
        }

        const rootType = this.getSchemaType(schemaName, rootTypeName);

        if (!rootType) {
            log.error(
                LOG_AREA,
                'Protobuf parsing failed - root type not found',
                {
                    schemaName,
                    rootTypeName,
                },
            );
            throw new Error('Protobuf parsing failed - root type not found');
        }

        try {
            let byteArray;

            // With support from raw websocket streaming, it's possible to get raw ArrayBuffer.
            if (data instanceof Uint8Array) {
                byteArray = data;
            } else {
                byteArray = new Uint8Array(
                    this.protobuf.util.base64.length(data),
                );
                const offset = 0;
                this.protobuf.util.base64.decode(data, byteArray, offset);
            }

            const message = rootType.decode(byteArray);
            const jsonData = message ? message.toJSON() : null;

            return this.metaProcessor.process(message, jsonData);
        } catch (error) {
            const base64Data =
                typeof data === 'string'
                    ? data
                    : this.protobuf.util.base64.encode(data, 0, data.length);
            log.error(LOG_AREA, 'Protobuf parsing failed', {
                error,
                base64Data,
                schema: this.schemasSourceMap[schemaName],
                schemaName,
            });
            throw new Error('Parsing failed');
        }
    }

    stringify(
        data: ProtoBuf.Message | Record<string, any>,
        schemaName: string,
    ) {
        const schema = this.getSchema(schemaName);
        const rootTypeName =
            schema.root.getOption(ROOT_OPTION_NAME) || schemaName;

        const bytes = this.encode(data, schemaName, rootTypeName);
        if (!bytes) {
            return null;
        }

        const start = 0;
        const end = bytes.length;
        return this.protobuf.util.base64.encode(bytes, start, end);
    }

    encode(
        data: ProtoBuf.Message | Record<string, any>,
        schemaName: string,
        typeName: string,
    ) {
        const schemaType = this.getSchemaType(schemaName, typeName);
        if (!schemaType) {
            return null;
        }

        return schemaType.encode(data).finish();
    }
    getFormatName() {
        return ParserProtobuf.FORMAT_NAME;
    }
}

export default ParserProtobuf;
