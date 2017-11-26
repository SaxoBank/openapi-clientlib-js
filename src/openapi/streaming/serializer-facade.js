import SerializeJson from './serializer/serializer-json';
import SerializeProtobuf from './serializer/serializer-protobuf';

/**
 * Serialization facade for multiple serialization solution.
 * @constructor
 */
function SerializerFacade() {}

SerializerFacade.serializerCreators = {
    [SerializeJson.FORMAT_NAME]: SerializeJson,
    [SerializeProtobuf.FORMAT_NAME]: SerializeProtobuf,
};

SerializerFacade.serializersMap = {};

SerializerFacade.defaultSerializer = SerializeJson;

SerializerFacade.getId = (format, serviceGroup, url) => {
    if (format === SerializeJson.FORMAT_NAME || !format) {
        // Makes sure that all JSON formats share serializer.
        return SerializeJson.FORMAT_NAME;
    }

    // Ensures that other formats ie. protobuf, have serializer per endpoint.
    return `${format}.${serviceGroup}.${url}`;
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
    const id = SerializerFacade.getId(format, serviceGroup, url);

    if (SerializerFacade.serializersMap[id]) {
        return SerializerFacade.serializersMap[id];
    }
    const Serializer = SerializerFacade.serializerCreators[format] || SerializerFacade.defaultSerializer;
    SerializerFacade.serializersMap[id] = new Serializer(id);

    return SerializerFacade.serializersMap[id];
};

export default SerializerFacade;
