import SerializerInterface from './serializer-interface';

/**
 * JSON Serialization
 * @constructor
 */
function SerializerJson(name, engine = null) {
    this.name = name;
    this.engine = engine;
}

SerializerJson.prototype = Object.create(
    SerializerInterface.prototype,
    { constructor: { value: SerializerJson, enumerable: false, writable: true, configurable: true } }
);

SerializerJson.prototype.parse = function(data, schemaName) {
    return data;
};

SerializerJson.prototype.stringify = function(data, schemaName) {
    return JSON.stringify(data);
};

SerializerJson.prototype.getFormatName = function() {
    return SerializerJson.FORMAT_NAME;
};

SerializerJson.FORMAT_NAME = 'application/json';

export default SerializerJson;
