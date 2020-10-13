import microEmitter from 'src/micro-emitter';

function mockAuthProvider() {
    const EVENT_TOKEN_RECEIVED = 'testTokenReceived';

    const emitter = {};
    microEmitter.mixinTo(emitter);

    const authProvider = {
        getToken: jest.fn().mockImplementation(() => 'Bearer TOKEN'),
        getExpiry: jest.fn().mockImplementation(() => Date.now() + 1000),
        setExpiry(value) {
            this.getExpiry.mockImplementation(() => value);
        },
        on: jest.fn().mockImplementation((eventName, cb, context) => {
            if (eventName !== EVENT_TOKEN_RECEIVED) {
                throw new Error('unexpected event call');
            }
            emitter.on(eventName, cb, context);
        }),
        one: jest.fn().mockImplementation((eventName, cb, context) => {
            if (eventName !== EVENT_TOKEN_RECEIVED) {
                throw new Error('unexpected event call');
            }
            emitter.one(eventName, cb, context);
        }),
        off: jest.fn().mockImplementation((eventName, cb, context) => {
            if (eventName !== EVENT_TOKEN_RECEIVED) {
                throw new Error('unexpected event call');
            }
            emitter.off(eventName, cb, context);
        }),
        triggerTokenReceived() {
            emitter.trigger(EVENT_TOKEN_RECEIVED);
        },
        tokenRejected: jest.fn(),
        isFetchingNewToken: jest.fn().mockReturnValue(false),
        refreshOpenApiToken: jest.fn(),
        EVENT_TOKEN_RECEIVED,
    };

    return authProvider;
}

export default mockAuthProvider;
