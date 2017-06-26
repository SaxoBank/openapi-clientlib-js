import * as config from './config';

import standardTests from './standard-tests';

describe('when using just transport auth', () => {
    const transportAuth = new saxo.openapi.TransportAuth(config.baseUrl, {
        token: config.token,
        expiry: new Date(new Date().getTime() + 1000 * 60 * 60 * 10),
        language: 'en-US',
    });

    const streaming = new saxo.openapi.Streaming(transportAuth, config.baseUrl, transportAuth.auth);

    standardTests({
        streaming,
        transport: transportAuth,
    });

    it('disposes okay', () => {
        expect(() => {
            streaming.dispose();
            transportAuth.dispose();
        }).not.toThrow();
    });
});
