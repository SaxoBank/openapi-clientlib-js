/**
 * JSON Serialization
 * @constructor
 */
function SerializerJson(name) {
    this.name = name;
}

SerializerJson.prototype.getSchemaNames = function() {
    return null;
};

SerializerJson.prototype.getSchema = function(name) {
    return null;
};

SerializerJson.prototype.addSchema = function(schema, name, serviceGroup, url) {
    // Not supported
};

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
