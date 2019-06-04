import ParserJson from './parser-json';
import { extend } from '../../../utils/object';

const parserCreators = {
    [ParserJson.FORMAT_NAME]: ParserJson,
};

/**
 * Map of engines per format. ie
 * { 'application/x-protobuf: protobuf }
 */
const enginesMap = {};

/**
 * Map of parsers per format. ie.
 * { 'application/x-protobuf: ParserProtobuf }
 */
const parsersMap = {};

const defaultParser = ParserJson;

const getId = (format, serviceGroup, url) => {
    if (format === ParserJson.FORMAT_NAME || !format) {
        // Makes sure that all JSON formats share same single parser.
        return ParserJson.FORMAT_NAME;
    }

    // Ensures that other formats ie. protobuf, have parser per endpoint.
    return `${format}.${serviceGroup}.${url}`;
};

/**
 * Parser facade for multiple parsing solution.
 */
const ParserFacade = {};

/**
 * Add parser engine for given endpoint.
 * Use case:
 *     Protobuf parsing, where protobufjs library is imported in userspace and provided as configuration to openapi-clientlib.
 *     Allows for keeping openapi-library size low, and configuring only 'what we need' for given platform.
 *     For example, omitting protobuf from phone platform.
 *
 * @param {Object} map - The engine map, where key is format name and value is engine object/constructor.
 *     Example: { 'applications/x-protobuf': protobuf }
 */
ParserFacade.addEngines = function(map) {
    extend(enginesMap, map);
};

/**
 * Add parsing methods.
 * @param {Object} map - The parser map, where key is format name and value is factory for parser.
 */
ParserFacade.addParsers = function(map) {
    extend(parserCreators, map);
};

ParserFacade.getDefaultFormat = function() {
    return defaultParser.FORMAT_NAME;
};

/**
 * Check if given format is supported by available parser.
 * @param {String} format - Data format ie. application/json
 * @return {Boolean} - Returns true if format is supported. Returns false if format is not supported by available parsing methods.
 */
ParserFacade.isFormatSupported = function(format) {
    return Boolean(parserCreators[format]);
};

/**
 * Get parser for given format name, service group and url.
 * Parsers are mapped per name, service and url, to keep schemas per endpoints.
 * Such approach is required as schemas are currently not namespaced and reuse similar message names with different structures.
 * Due to that, we need to keep per endpoint parsers for protobuf parsing type.
 *
 * @param {String} format - The format name. ie. "application/json"
 * @param {String} serviceGroup - The service group
 * @param {String} url - The url for given endpoint
 * @return {Object} Parser
 */
ParserFacade.getParser = function(format, serviceGroup, url) {
    const id = getId.call(this, format, serviceGroup, url);

    if (parsersMap[id]) {
        return parsersMap[id];
    }
    const Parser = parserCreators[format] || defaultParser;
    const engine = enginesMap[format];

    parsersMap[id] = new Parser(id, engine);

    return parsersMap[id];
};

export default ParserFacade;
