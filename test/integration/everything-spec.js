import * as config from './config';

import standardTests from './standard-tests';

describe("when using everything", () => {
	var transportAuth = new saxo.openapi.TransportAuth(config.baseUrl, {
		token: config.token,
		expiry: new Date(new Date().getTime() + 1000 * 60 * 60 * 10),
		language: 'en-US'
	});

	var transportBatch = new saxo.openapi.TransportBatch(transportAuth, config.baseUrl, transportAuth.auth);

	// wait for the 2 isalive calls for the load balancer cookies
	var portAlive = transportAuth.get("port", "isalive");
	var tradeAlive = transportAuth.get("trade", "isalive");

	var transportQueue = new saxo.openapi.TransportQueue(transportBatch, transportAuth);
	transportQueue.waitFor(portAlive);
	transportQueue.waitFor(tradeAlive);

	var streaming = new saxo.openapi.Streaming(transportQueue, config.baseUrl, transportAuth.auth);

	standardTests({
		streaming: streaming,
		transport: transportQueue
	});

	it("disposes okay", () => {
		expect(() => {
			streaming.dispose();
			transportQueue.dispose();
		}).not.toThrow();
	});
});
