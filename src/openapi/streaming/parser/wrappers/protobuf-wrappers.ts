import type { IWrapper, Message } from 'protobufjs';

export default {
    register: (wrappers: Record<string, IWrapper>) => {
        if (!wrappers['.google.protobuf.Timestamp']) {
            wrappers['.google.protobuf.Timestamp'] = {
                fromObject(object) {
                    return this.fromObject(object);
                },

                toObject(message: Message): Record<string, any> {
                    // casting type since it's not able to tel TS that the message contains proper types
                    const { seconds, nanos } = (message as unknown) as {
                        nanos?: number;
                        seconds?: number;
                    };

                    // Date with support for nano precision
                    const date = new Date(
                        Number(seconds) * 1000 +
                            Math.floor(Number(nanos) / 1000000),
                    );

                    // @ts-expect-error FIXME TS is complaining that a string is returned,
                    // instead of an object - verify if it's a bug or expected since the lib
                    // returns object for timestamp type:
                    // https://github.com/protobufjs/protobuf.js/blob/95b56817ef6fb9bdcb14d956c159da49d0889bff/src/common.js#L93;
                    return date.toJSON();
                },
            };
        }
    },
};
