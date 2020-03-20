export default {
    register: (wrappers) => {
        if (!wrappers['.google.protobuf.Timestamp']) {
            wrappers['.google.protobuf.Timestamp'] = {
                fromObject(object) {
                    return this.fromObject(object);
                },

                toObject(message, options) {
                    const { seconds, nanos } = message;

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
