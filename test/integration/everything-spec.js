import * as config from './config';

import standardTests from './standard-tests';

describe('when using everything', () => {
    const transportAuth = new saxo.openapi.TransportAuth(config.baseUrl, {
        token: config.token,
        expiry: new Date(new Date().getTime() + 1000 * 60 * 60 * 10),
        language: 'en-US',
    });

    const transportBatch = new saxo.openapi.TransportBatch(transportAuth, config.baseUrl, transportAuth.auth);

    // wait for the 2 isalive calls for the load balancer cookies
    const portAlive = transportAuth.get('port', 'isalive');
    const tradeAlive = transportAuth.get('trade', 'isalive');

    const transportQueue = new saxo.openapi.TransportQueue(transportBatch, transportAuth);
    transportQueue.waitFor(portAlive);
    transportQueue.waitFor(tradeAlive);

    const streaming = new saxo.openapi.Streaming(transportQueue, config.baseUrl, transportAuth.auth);

    standardTests({
        streaming,
        transport: transportQueue,
    });

    it('disposes okay', () => {
        expect(() => {
            streaming.dispose();
            transportQueue.dispose();
        }).not.toThrow();
    });
});
