import MetaProcessor from './meta/meta-protobuf';
import wrappers from './wrappers/protobuf-wrappers';
import protobuf from 'protobufjs/dist/protobuf.min';
import log from '../../../log';

const LOG_AREA = 'SerializerProtobuf';

// Register custom wrappers to support JS types. ie. casting Google.Timestamp to JS Date.
wrappers.register(protobuf.wrappers);

/**
 * Protobuf Serialization
 * @constructor
 */
function SerializerProtobuf(name) {
    this.name = name;

    try {
        this.schemas = protobuf.Root.fromJSON(protobuf.common['google/protobuf/wrappers.proto'], protobuf.root);
        this.schemas = protobuf.Root.fromJSON(protobuf.common['google/protobuf/timestamp.proto'], this.schemas);
    } catch (e) {
        log.error(LOG_AREA, 'Parsing of global schemas failed.', e.message);
    }

    /**
     * Url to schema name map.
     */
    this.schemasUrlMap = {};

    /**
     * Processed all meta fields of decoded message type.
     * @type {MetaProtobuf}
     */
    this.metaProcessor = new MetaProcessor();
}

SerializerProtobuf.prototype.getSchema = function(name) {
    return this.schemas.root.lookup(name);
};

SerializerProtobuf.prototype.getSchemas = function() {
    return this.schemas;
};

SerializerProtobuf.prototype.getUrlSchemaName = function(serviceGroup, url) {
    return this.schemasUrlMap[`${serviceGroup}/${url}`];
};

SerializerProtobuf.prototype.getSchemaNames = function() {
    const values = [];
    for (const key in this.schemasUrlMap) {
        if (this.schemasUrlMap.hasOwnProperty(key)) {
            values.push(this.schemasUrlMap[key]);
        }
    }
    return values;
};

SerializerProtobuf.prototype.addSchema = function(schema, name, serviceGroup, url) {
    let nextSchemas;

    try {
        nextSchemas = protobuf.parse(schema, this.schemas.root, { keepCase: true });
    } catch (e) {
        log.error(LOG_AREA, 'Schema parsing failed', {
            error: e.message,
            name,
        });

        return false;
    }

    this.schemasUrlMap[`${serviceGroup}/${url}`] = name;
    this.schemas = nextSchemas;

    return true;
};

SerializerProtobuf.prototype.parse = function(data, schemaName) {
    const rootTypeName = this.schemas.root.getOption('saxobank_root');

    if (!data) {
        return null;
    }

    if (!rootTypeName) {
        log.error('Parsing failed. Missing root message name', rootTypeName);
        return null;
    }

    const rootType = this.schemas.root.lookupType(rootTypeName);

    if (!rootType) {
        log.error('Parsing failed. Missing root type name', rootTypeName);
        return null;
    }

    const byteArray = new Uint8Array(protobuf.util.base64.length(data));

    try {
        protobuf.util.base64.decode(data, byteArray, 0);
    } catch (e) {
        log.error('Parsing failed. Conversion to byteArray from base64 failed', { error: e.message, data });
        return null;
    }

    let message = null;

    try {
        message = rootType.decode(byteArray);
    } catch (e) {
        log.error('Parsing failed. Protobuf Decoding of byteArray failed', e.message);
        return null;
    }

    const jsonData = message ? message.toJSON() : null;
    return this.metaProcessor.process(message, jsonData);
};

SerializerProtobuf.prototype.stringify = function(data, schemaName) {
    const rootTypeName = this.schemas.root.getOption('saxobank_root') || schemaName;

    const bytes = this.encode(data, rootTypeName);
    if (!bytes) {
        return null;
    }
    return protobuf.util.base64.encode(bytes, 0, bytes.length);
};

SerializerProtobuf.prototype.encode = function(data, schemaName) {
    const schema = this.getSchema(schemaName);
    if (!schema) {
        return null;
    }

    return schema.encode(data).finish();
};

SerializerProtobuf.prototype.getFormatName = function() {
    return SerializerProtobuf.FORMAT_NAME;
};

SerializerProtobuf.FORMAT_NAME = 'application/x-protobuf';

export default SerializerProtobuf;
