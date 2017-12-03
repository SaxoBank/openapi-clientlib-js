/**
 * Serialization Interface
 * @constructor
 */
function SerializerInterface(name, engine = null) {

    // Serialization name, used for lookup.
    this.name = name;

    // Optional serialization engine.
    this.engine = engine;
}

SerializerInterface.prototype.getSchemaNames = function() {};

SerializerInterface.prototype.getSchemaType = function(schemaName, schemaType) {};

SerializerInterface.prototype.getSchemaName = function(name) {};

SerializerInterface.prototype.getSchema = function(name) {};

SerializerInterface.prototype.addSchema = function(schema, name) {};

SerializerInterface.prototype.parse = function(data, schemaName) {};

SerializerInterface.prototype.stringify = function(data, schemaName) {};

SerializerInterface.prototype.getFormatName = function() {
    return this.prototype.FORMAT_NAME;
};

export default SerializerInterface;
