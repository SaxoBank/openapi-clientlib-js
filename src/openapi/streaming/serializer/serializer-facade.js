import SerializeJson from './serializer-json';
import { extend } from '../../../utils/object';

const serializerCreators = {
    [SerializeJson.FORMAT_NAME]: SerializeJson,
};

/**
 * Map of engines per format. ie
 * { 'application/x-protobuf: protobuf }
 */
const enginesMap = {};

/**
 * Map of serializers per format. ie.
 * { 'application/x-protobuf: SerializerProtobuf }
 */
const serializersMap = {};

const defaultSerializer = SerializeJson;

const getId = (format, serviceGroup, url) => {
    if (format === SerializeJson.FORMAT_NAME || !format) {
        // Makes sure that all JSON formats share serializer.
        return SerializeJson.FORMAT_NAME;
    }

    // Ensures that other formats ie. protobuf, have serializer per endpoint.
    return `${format}.${serviceGroup}.${url}`;
};

/**
 * Serialization facade for multiple serialization solution.
 */
const SerializerFacade = {};

/**
 * Add serialization engine for given endpoint.
 * Use case:
 *     Protobuf serialization, where protobufjs library is imported in userspace and provided as configuration to openapi-clientlib.
 *     Allows for keeping openapi-library size low, and configuring only 'what we need' for given platform.
 *     For example, omitting protobuf from phone platform.
 *
 * @param {Object} map - The engine map, where key is format name and value is engine object/constructor.
 *     Example: { 'applications/x-protobuf': protobuf }
 */
SerializerFacade.addEngines = function(map) {
    extend(enginesMap, map);
};

/**
 * Add serialization methods.
 * @param {Object} map - The serialization map, where key is format name and value is factory for serializer.
 */
SerializerFacade.addSerializers = function(map) {
    extend(serializerCreators, map);
};

SerializerFacade.getDefaultFormat = function() {
    return defaultSerializer.FORMAT_NAME;
};

/**
 * Check if given format is supported by available serializers.
 * @param {String} format - Data format ie. application/json
 * @return {Boolean} - Returns true if format is supported. Returns false if format is not supported by available serialization methods.
 */
SerializerFacade.isFormatSupported = function(format) {
    return Boolean(serializerCreators[format]);
};

/**
 * Get serializer for given format name, service group and url.
 * Serialized are mapped per name, service and url, to keep schemas per endpoints.
 * Such approach is required as schemas are currently not namespaced and reuse similar message names with different structures.
 * Due to that, we need to keep per endpoint serializers for protobuf serialization type.
 *
 * @param {String} format - The format name. ie. "application/json"
 * @param {String} serviceGroup - The service group
 * @param {String} url - The url for given endpoint
 * @return {Object} Serializer
 */
SerializerFacade.getSerializer = function(format, serviceGroup, url) {
    const id = getId.call(this, format, serviceGroup, url);

    if (serializersMap[id]) {
        return serializersMap[id];
    }
    const Serializer = serializerCreators[format] || defaultSerializer;
    const engine = enginesMap[format];

    serializersMap[id] = new Serializer(id, engine);

    return serializersMap[id];
};

export default SerializerFacade;
