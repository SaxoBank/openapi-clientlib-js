import type { IWrapper, Message } from 'protobufjs';

export default {
    register: (wrappers: Record<string, IWrapper>) => {
        if (!wrappers['.google.protobuf.Timestamp']) {
            wrappers['.google.protobuf.Timestamp'] = {
                fromObject(object) {
                    return this.fromObject(object);
                },

                // @ts-expect-error invalid return type of IWrapper.toObject
                // We normalize timestamp to the format supported by OAPI and return string instead of an object
                // see {@link https://github.com/protocolbuffers/protobuf/blob/master/src/google/protobuf/timestamp.proto#L110}
                toObject(message: Message) {
                    const { seconds, nanos } = message as unknown as {
                        nanos?: any;
                        seconds?: any;
                    };

                    // Date with support for nano precision
                    const date = new Date(
                        Number(seconds) * 1000 +
                            Math.floor(Number(nanos) / 1000000),
                    );

                    return date.toJSON();
                },
            };
        }
    },
};
