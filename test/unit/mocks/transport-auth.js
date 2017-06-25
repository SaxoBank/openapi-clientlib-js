const microEmitter = saxo.microEmitter;

function mockTransportAuth() {
    const transportAuth = {};
    transportAuth.auth = jasmine.createSpyObj('auth', ['getToken', 'getExpiry']);

    let expiry = 0;
    transportAuth.auth.setExpiry = function(newExpiry) {
        expiry = newExpiry;
    };
    transportAuth.auth.getExpiry.and.callFake(() => expiry);
    transportAuth.EVENT_TOKEN_RECEIVED = 'testing this can change';

    microEmitter.mixinTo(transportAuth);

    transportAuth.onTokenInvalid = jasmine.createSpy('mockTransportAuth.onTokenInvalid');

    return transportAuth;
}

export default mockTransportAuth;
