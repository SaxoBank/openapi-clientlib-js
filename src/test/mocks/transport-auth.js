import microEmitter from '../../micro-emitter';

function mockTransportAuth() {
    const transportAuth = {};
    transportAuth.auth = { getToken: jest.fn(), getExpiry: jest.fn() };

    let expiry = 0;
    transportAuth.auth.setExpiry = function(newExpiry) {
        expiry = newExpiry;
    };
    transportAuth.auth.getExpiry.mockImplementation(() => expiry);
    transportAuth.EVENT_TOKEN_RECEIVED = 'testing this can change';

    microEmitter.mixinTo(transportAuth);

    transportAuth.checkAuthExpiry = jest.fn().mockName('mockTransportAuth.checkAuthExpiry');

    return transportAuth;
}

export default mockTransportAuth;
