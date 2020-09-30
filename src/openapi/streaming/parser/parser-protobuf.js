import ParserBase from './parser-base';
import MetaProcessor from './meta/meta-protobuf';
import wrappers from './wrappers/protobuf-wrappers';
import log from '../../../log';

const LOG_AREA = 'ParserProtobuf';

const ROOT_OPTION_NAME = 'saxobank_root';

/**
 * Create root schema and register custom wrappers to support JS types. ie. casting Google.Timestamp to JS Date.
 * @returns {Root}
 */
function createRootSchema() {
    let schemas = this.protobuf.Root.fromJSON(
        this.protobuf.common['google/protobuf/wrappers.proto'],
        this.protobuf.root,
    );
    schemas = this.protobuf.Root.fromJSON(
        this.protobuf.common['google/protobuf/timestamp.proto'],
        schemas,
    );
    return schemas;
}

/**
 * Protobuf Parser.
 */
function ParserProtobuf(name, engine) {
    this.name = name;

    // Parsing engine, currently only supported implementation is: https://github.com/dcodeIO/ProtoBuf.js
    this.protobuf = engine;

    wrappers.register(this.protobuf.wrappers);

    /**
     * Url to schema name map.
     */
    this.schemasMap = {};

    /**
     * Url to schema name map.
     */
    this.schemasSourceMap = {};

    this.lastSchemaName = null;

    /**
     * Processing of supported meta fields of decoded message type.
     * @type {MetaProtobuf}
     */
    this.metaProcessor = new MetaProcessor();
}

ParserProtobuf.prototype = Object.create(ParserBase.prototype, {
    constructor: {
        value: ParserProtobuf,
        enumerable: false,
        writable: true,
        configurable: true,
    },
});

ParserProtobuf.prototype.getSchemaType = function(schemaName, typeName) {
    const schemas = this.schemasMap[schemaName];
    return schemas && schemas.root.lookup(typeName);
};

ParserProtobuf.prototype.getSchemaName = function() {
    return this.lastSchemaName;
};

ParserProtobuf.prototype.getSchema = function(name) {
    return this.schemasMap[name];
};

ParserProtobuf.prototype.getSchemaNames = function() {
    return Object.keys(this.schemasMap);
};

/**
 * Parses and adds schema to local schema map.
 * @param {String} schemaData - The schema data, not parsed, in raw, string format.
 * @param {String} name - The schema name, under which it will be saved in schema map.
 * @return {boolean} - Returns true if there were no issues, false otherwise.
 */
ParserProtobuf.prototype.addSchema = function(schemaData, name) {
    if (this.schemasMap[name]) {
        // Schemas for this name already exist.
        return true;
    }

    let schema = createRootSchema.call(this, this.protobuf);
    try {
        schema = this.protobuf.parse(schemaData, schema.root, {
            keepCase: true,
        });
    } catch (e) {
        log.error(LOG_AREA, 'Schema parsing failed', {
            error: e.message,
            name,
        });

        return false;
    }

    this.schemasSourceMap[name] = schemaData;
    this.schemasMap[name] = schema;
    this.lastSchemaName = name;
    return true;
};

/**
 * Parse data using given schema. Data should be in base64 format.
 * @param {String} data - The data to parse. Data should be in base64 format.
 * @param {String} schemaName - The name of a schema to be used for parsing.
 * @return {Object} - Result of parsing, if successful. Returns null if parsing fails or there is no data.
 */
ParserProtobuf.prototype.parse = function(data, schemaName) {
    if (!data) {
        return null;
    }

    const schemas = this.getSchema(schemaName);

    if (!schemas) {
        log.error(LOG_AREA, 'Protobuf parsing failed - failed to get schemas', {
            schemaName,
        });
        throw new Error('Protobuf parsing failed');
    }

    const rootTypeName = schemas.root.getOption(ROOT_OPTION_NAME);

    if (!rootTypeName) {
        log.error(
            LOG_AREA,
            'Protobuf parsing failed - missing root message name',
            { rootTypeName },
        );
        throw new Error('Protobuf parsing failed');
    }

    const rootType = this.getSchemaType(schemaName, rootTypeName);

    if (!rootType) {
        log.error(
            LOG_AREA,
            'Protobuf parsing failed - root type not found. Name: ',
            { rootTypeName },
        );
        throw new Error('Protobuf parsing failed');
    }

    try {
        let byteArray;

        // With support from raw websocket streaming, it's possible to get raw ArrayBuffer.
        if (data instanceof Uint8Array) {
            byteArray = data;
        } else {
            byteArray = new Uint8Array(this.protobuf.util.base64.length(data));
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
        log.error('Protobuf parsing failed', {
            error,
            base64Data,
            schema: this.schemasSourceMap[schemaName],
        });
        throw new Error('Parsing failed');
    }
};

ParserProtobuf.prototype.stringify = function(data, schemaName) {
    const schema = this.getSchema(schemaName);
    const rootTypeName = schema.root.getOption(ROOT_OPTION_NAME) || schemaName;

    const bytes = this.encode(data, schemaName, rootTypeName);
    if (!bytes) {
        return null;
    }

    const start = 0;
    const end = bytes.length;
    return this.protobuf.util.base64.encode(bytes, start, end);
};

ParserProtobuf.prototype.encode = function(data, schemaName, typeName) {
    const schemaType = this.getSchemaType(schemaName, typeName);
    if (!schemaType) {
        return null;
    }

    return schemaType.encode(data).finish();
};

ParserProtobuf.prototype.getFormatName = function() {
    return ParserProtobuf.FORMAT_NAME;
};

ParserProtobuf.FORMAT_NAME = 'application/x-protobuf';

export default ParserProtobuf;
