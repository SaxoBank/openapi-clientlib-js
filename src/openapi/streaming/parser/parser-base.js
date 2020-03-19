/**
 * Parser Base
 * @constructor
 */
function ParserBase(name, engine = null) {
    // Parser name, used for lookup.
    this.name = name;

    // Optional parsing engine.
    this.engine = engine;
}

ParserBase.prototype.getSchemaNames = function() {};

ParserBase.prototype.getSchemaType = function(schemaName, schemaType) {};

ParserBase.prototype.getSchemaName = function(name) {};

ParserBase.prototype.getSchema = function(name) {};

ParserBase.prototype.addSchema = function(schema, name) {};

ParserBase.prototype.parse = function(data, schemaName) {};

ParserBase.prototype.stringify = function(data, schemaName) {};

ParserBase.prototype.getFormatName = function() {
    return this.prototype.FORMAT_NAME;
};

export default ParserBase;
