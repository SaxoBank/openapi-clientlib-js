import SerializerInterface from './serializer-interface';
import MetaProcessor from './meta/meta-protobuf';
import wrappers from './wrappers/protobuf-wrappers';
import log from '../../../log';

const LOG_AREA = 'SerializerProtobuf';

const ROOT_OPTION_NAME = 'saxobank_root';

// Register custom wrappers to support JS types. ie. casting Google.Timestamp to JS Date.

function createRootSchema() {
    let schemas = this.protobuf.Root.fromJSON(this.protobuf.common['google/protobuf/wrappers.proto'], this.protobuf.root);
    schemas = this.protobuf.Root.fromJSON(this.protobuf.common['google/protobuf/timestamp.proto'], schemas);
    return schemas;
}

/**
 * Protobuf Serialization.
 */
function SerializerProtobuf(name, engine) {
    this.name = name;

    // Serialization engine, currently only supported implementation: https://github.com/dcodeIO/ProtoBuf.js
    this.protobuf = engine;

    wrappers.register(this.protobuf.wrappers);

    /**
     * Url to schema name map.
     */
    this.schemasMap = {};

    this.lastSchemaName = null;

    /**
     * Processed all meta fields of decoded message type.
     * @type {MetaProtobuf}
     */
    this.metaProcessor = new MetaProcessor();
}

SerializerProtobuf.prototype = Object.create(
    SerializerInterface.prototype,
    { constructor: { value: SerializerProtobuf, enumerable: false, writable: true, configurable: true } }
);

SerializerProtobuf.prototype.getSchemaType = function(schemaName, typeName) {
    const schemas = this.schemasMap[schemaName];
    return schemas && schemas.root.lookup(typeName);
};

SerializerProtobuf.prototype.getSchemaName = function() {
    return this.lastSchemaName;
};

SerializerProtobuf.prototype.getSchema = function(name) {
    return this.schemasMap[name];
};

SerializerProtobuf.prototype.getSchemaNames = function() {
    return Object.keys(this.schemasMap);
};

/**
 * Parses and adds schema to local schema map.
 * @param {String} schemaData - The schema data, not parsed, in raw, string format.
 * @param {String} name - The schema name, under which it will be saved in schema map.
 * @return {boolean} - Returns true if there were no issues, false otherwise.
 */
SerializerProtobuf.prototype.addSchema = function(schemaData, name) {
    if (this.schemasMap[name]) {
        // Schemas for this name already exist.
        return true;
    }

    let schema = createRootSchema.call(this, this.protobuf);
    try {
        schema = this.protobuf.parse(schemaData, schema.root, { keepCase: true });
    } catch (e) {
        log.error(LOG_AREA, 'Schema parsing failed', {
            error: e.message,
            name,
        });

        return false;
    }

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
SerializerProtobuf.prototype.parse = function(data, schemaName) {
    const schemas = this.getSchema(schemaName);

    if (!schemas || !data) {
        return null;
    }

    const rootTypeName = schemas.root.getOption(ROOT_OPTION_NAME);

    if (!rootTypeName) {
        log.error('Parsing failed. Missing root message name', rootTypeName);
        return null;
    }

    const rootType = this.getSchemaType(schemaName, rootTypeName);

    if (!rootType) {
        log.error('Parsing failed. Root type not found. Name: ', rootTypeName);
        return null;
    }

    const byteArray = new Uint8Array(this.protobuf.util.base64.length(data));

    const offset = 0;
    this.protobuf.util.base64.decode(data, byteArray, offset);

    const message = rootType.decode(byteArray);
    const jsonData = message ? message.toJSON() : null;

    return this.metaProcessor.process(message, jsonData);
};

SerializerProtobuf.prototype.stringify = function(data, schemaName) {
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

SerializerProtobuf.prototype.encode = function(data, schemaName, typeName) {
    const schemaType = this.getSchemaType(schemaName, typeName);
    if (!schemaType) {
        return null;
    }

    return schemaType.encode(data).finish();
};

SerializerProtobuf.prototype.getFormatName = function() {
    return SerializerProtobuf.FORMAT_NAME;
};

SerializerProtobuf.FORMAT_NAME = 'application/x-protobuf';

export default SerializerProtobuf;
