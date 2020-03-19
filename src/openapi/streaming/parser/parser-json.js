import ParserBase from './parser-base';

/**
 * JSON Serialization
 * @constructor
 */
function ParserJson(name, engine = null) {
    this.name = name;
    this.engine = engine;
}

ParserJson.prototype = Object.create(ParserBase.prototype, {
    constructor: {
        value: ParserJson,
        enumerable: false,
        writable: true,
        configurable: true,
    },
});

ParserJson.prototype.parse = function(data, schemaName) {
    return data;
};

ParserJson.prototype.stringify = function(data, schemaName) {
    return JSON.stringify(data);
};

ParserJson.prototype.getFormatName = function() {
    return ParserJson.FORMAT_NAME;
};

ParserJson.FORMAT_NAME = 'application/json';

export default ParserJson;
