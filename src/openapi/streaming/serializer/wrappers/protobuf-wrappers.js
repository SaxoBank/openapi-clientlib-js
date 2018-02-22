export default {
    register: (wrappers) => {
        if (!wrappers['.google.protobuf.Timestamp']) {
            wrappers['.google.protobuf.Timestamp'] = {
                fromObject(object) {
                    return this.fromObject(object);
                },

                toObject(message, options) {
                    const seconds = Number(message.seconds) * 1000;
                    const date = new Date(seconds);

                    return date.toJSON();
                },
            };
        }
    },
};
