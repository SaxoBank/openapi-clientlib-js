import type * as ProtoBuf from 'protobufjs';

const META_NULLS = '__meta_nulls';
const META_EMPTY = '__meta_empty';

type Flags = Record<string, true>;
type Data = Record<string, any>;

type Message = {
    [META_NULLS]?: number[];
    [META_EMPTY]?: number[];
} & ProtoBuf.Message;

/**
 * Map of accessors for custom global envelopes.
 */
const CUSTOM_ENVELOPES: Record<string, (data: Data) => Data> = {
    CollectionEnvelope: (data: Data) => data.Collection,
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

/**
 * Responsible for processing of all custom meta fields of decoded message type.
 * More info: https://wiki/display/OpenAPI/Delta+compression+implementation+of+ProtoBuffers
 */
class MetaProtobuf {
    /**
     * Process data using message metadata. Iterate through each field and process supported metadata keys.
     *
     * @param message - Protobuf Message Type object.
     * @param data - JSON object. Object get's mutated.
     * @returns  The result of meta processing.
     */
    process(message: Message | null, data: Data | null): Data | null {
        if (!message || !data) {
            return data;
        }

        this.iterateTree([message], [data]);

        for (const key in CUSTOM_ENVELOPES) {
            if (message.$type.name === key) {
                data = CUSTOM_ENVELOPES[key](data);
            }
        }

        return data;
    }

    private iterateTree(
        message: Record<string, any>,
        data: Record<string, any>,
    ) {
        for (const key in data) {
            if (data.hasOwnProperty(key) && !(META_TYPES as Flags)[key]) {
                const nextData = data[key];
                if (typeof nextData === 'object') {
                    this.processChild(message[key], data[key]);
                    this.iterateTree(message[key], nextData);
                }
            }
        }
        return data;
    }

    private processChild(message: Message, data: Data) {
        if (!message) {
            return data;
        }

        const metaNulls = message[META_NULLS];
        const metaEmpty = message[META_EMPTY];

        if (metaNulls?.length) {
            this.processData(message, data, metaNulls, nullAccessor);

            // Remove deleting as soon as we move metadata to extensions.
            delete data[META_NULLS];
        }
        if (metaEmpty?.length) {
            this.processData(message, data, metaEmpty, emptyAccessor);

            // Remove deleting as soon as we move metadata to extensions.
            delete data[META_EMPTY];
        }

        return data;
    }

    private processData(
        message: Message,
        data: Data,
        ids: number[],
        accessor: () => null | any[],
    ) {
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const field = message.$type.fieldsById[id];
            if (!field) {
                continue;
            }
            data[field.name] = accessor();
        }
    }
}
export default MetaProtobuf;
