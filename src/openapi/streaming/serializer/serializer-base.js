/**
 * Serialization Base
 * @constructor
 */
function SerializerBase(name, engine = null) {

    // Serialization name, used for lookup.
    this.name = name;

    // Optional serialization engine.
    this.engine = engine;
}

SerializerBase.prototype.getSchemaNames = function() {};

SerializerBase.prototype.getSchemaType = function(schemaName, schemaType) {};

SerializerBase.prototype.getSchemaName = function(name) {};

SerializerBase.prototype.getSchema = function(name) {};

SerializerBase.prototype.addSchema = function(schema, name) {};

SerializerBase.prototype.parse = function(data, schemaName) {};

SerializerBase.prototype.stringify = function(data, schemaName) {};

SerializerBase.prototype.getFormatName = function() {
    return this.prototype.FORMAT_NAME;
};

export default SerializerBase;
