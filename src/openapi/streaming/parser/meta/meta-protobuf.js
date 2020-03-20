const META_NULLS = '__meta_nulls';
const META_EMPTY = '__meta_empty';

/**
 * Map of accessors for custom global envelopes.
 */
const CUSTOM_ENVELOPES = {
    CollectionEnvelope: (data) => data.Collection,
};

/**
 * Map of supported meta types that should be processed.
 * As an example, __meta_delete doesn't require any processing in this scope.
 */
const META_TYPES = {
    [META_NULLS]: true,
    [META_EMPTY]: true,
};

function nullAccessor() {
    return null;
}

function emptyAccessor() {
    return [];
}

function processData(message, data, ids, accessor) {
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const field = message.$type.fieldsById[id];
        if (!field) {
            continue;
        }
        data[field.name] = accessor();
    }
}

function processChild(message, data) {
    if (!message) {
        return data;
    }

    if (message[META_NULLS] && message[META_NULLS].length) {
        processData(message, data, message[META_NULLS], nullAccessor);

        // Remove deleting as soon as we move metadata to extensions.
        delete data[META_NULLS];
    }
    if (message[META_EMPTY] && message[META_EMPTY].length) {
        processData(message, data, message[META_EMPTY], emptyAccessor);

        // Remove deleting as soon as we move metadata to extensions.
        delete data[META_EMPTY];
    }

    return data;
}

function iterateTree(message, data) {
    for (const key in data) {
        if (data.hasOwnProperty(key) && !META_TYPES[key]) {
            const nextData = data[key];
            if (typeof nextData === 'object') {
                processChild.call(this, message[key], data[key]);
                iterateTree.call(this, message[key], nextData);
            }
        }
    }
    return data;
}

/**
 * Responsible for processing of all custom meta fields of decoded message type.
 * More info: https://wiki/display/OpenAPI/Delta+compression+implementation+of+ProtoBuffers
 * @constructor
 */
function MetaProtobuf() {}

/**
 * Process data using message metadata. Iterate through each field and process supported metadata keys.
 *
 * @param {Object} message - Protobuf Message Type object.
 * @param {Object} data - JSON object. Object get's mutated.
 * @return {Object} The result of meta processing.
 */
MetaProtobuf.prototype.process = function(message, data) {
    if (!message || !data) {
        return data;
    }

    iterateTree.call(this, [message], [data]);

    for (const key in CUSTOM_ENVELOPES) {
        if (message.$type.name === key) {
            data = CUSTOM_ENVELOPES[key](data);
        }
    }

    return data;
};

export default MetaProtobuf;
