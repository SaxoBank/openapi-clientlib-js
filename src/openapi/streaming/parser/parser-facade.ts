import { extend } from '../../../utils/object';
import ParserJson from './parser-json';
import type ParserBase from './parser-base';

type EnginesMap = Record<string, unknown>;
type ParsersMap = Record<string, ParserBase>;
type ParserCreatorsMap = Record<string, new (...args: any) => ParserBase>;

const parserCreators: ParserCreatorsMap = {
    [ParserJson.FORMAT_NAME]: ParserJson,
};

/**
 * Map of engines per format. ie
 * { 'application/x-protobuf: protobuf }
 */
const enginesMap: EnginesMap = {};

/**
 * Map of parsers per format. ie.
 * { 'application/x-protobuf: ParserProtobuf }
 */
const parsersMap: ParsersMap = {};

const defaultParser = ParserJson;

const getId = (
    format: string | undefined,
    servicePath: string,
    url: string,
) => {
    if (format === ParserJson.FORMAT_NAME || !format) {
        // Makes sure that all JSON formats share same single parser.
        return ParserJson.FORMAT_NAME;
    }

    // Ensures that other formats ie. protobuf, have parser per endpoint.
    return `${format}.${servicePath}.${url}`;
};

/**
 * Parser facade for multiple parsing solution.
 */
const ParserFacade = {
    /**
     * Add parser engine for given endpoint.
     * Use case:
     *     Protobuf parsing, where protobufjs library is imported in userspace and provided as configuration to openapi-clientlib.
     *     Allows for keeping openapi-library size low, and configuring only 'what we need' for given platform.
     *     For example, omitting protobuf from phone platform.
     *
     * @param {Object} engines - The engine map, where key is format name and value is engine object/constructor.
     *     Example: { 'applications/x-protobuf': protobuf }
     */
    addEngines(engines: EnginesMap) {
        extend(enginesMap, engines);
    },

    /**
     * Add parsing methods.
     * @param {Object} parsersCreatorsMap - The parser map, where key is format name and value is factory for parser.
     */
    addParsers(parsersCreatorsMap: ParserCreatorsMap) {
        extend(parserCreators, parsersCreatorsMap);
    },

    getDefaultFormat() {
        return defaultParser.FORMAT_NAME;
    },

    /**
     * Check if given format is supported by available parser.
     * @param {String} format - Data format ie. application/json
     * @return {Boolean} - Returns true if format is supported. Returns false if format is not supported by available parsing methods.
     */
    isFormatSupported(format?: string) {
        return Boolean(parserCreators[String(format)]);
    },

    /**
     * Get parser for given format name, service path and url.
     * Parsers are mapped per name, service and url, to keep schemas per endpoints.
     * Such approach is required as schemas are currently not namespaced and reuse similar message names with different structures.
     * Due to that, we need to keep per endpoint parsers for protobuf parsing type.
     *
     * @param {String} format - The format name. ie. "application/json"
     * @param {String} servicePath - The service path
     * @param {String} url - The url for given endpoint
     * @return {Object} Parser
     */
    getParser(format: string | undefined, servicePath: string, url: string) {
        const id = getId(format, servicePath, url);

        if (parsersMap[id]) {
            return parsersMap[id];
        }
        const Parser = (format && parserCreators[format]) || defaultParser;
        const engine = format && enginesMap[format];

        parsersMap[id] = new Parser(id, engine);

        return parsersMap[id];
    },
};

export default ParserFacade;
