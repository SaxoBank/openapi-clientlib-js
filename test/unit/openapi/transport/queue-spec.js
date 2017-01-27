var transport;
var transportQueue, transportAuth;
import { tick, installClock, uninstallClock } from '../../utils';
import mockTransport from '../../mocks/transport';
import mockTransportAuth from '../../mocks/transport-auth';

const TransportQueue = saxo.openapi.TransportQueue;

describe("openapi TransportQueue", () => {
	beforeEach(() => {
		transport = mockTransport();
		transportAuth = mockTransportAuth();
		installClock();
	});
	afterEach(function() {
		uninstallClock();
	});

	it("does not require options", () => {
		expect(function() {
			transportQueue = new TransportQueue(transport);
		}).not.toThrow();
	});

	it("defaults to not queuing", (done) => {
		transportQueue = new TransportQueue(transport);
		expect(transportQueue.isQueueing).toEqual(false);
		expect(transport.get.calls.count()).toEqual(0);

		transportQueue.get();
		tick(() => {
			expect(transport.get.calls.count()).toEqual(1);
			done();
		});
	});

	it("waits for a promise that is fullfilled", (done) => {
		transportQueue = new TransportQueue(transport);
		expect(transportQueue.isQueueing).toEqual(false);

		var waitingForPromiseResolve;
		transportQueue.waitFor(new Promise(function(resolve, reject) {
			waitingForPromiseResolve = resolve;
		}));

		var getPromise = transportQueue.get();
		tick(function() {
			expect(transport.get.calls.count()).toEqual(0);
			waitingForPromiseResolve();
			tick(function() {
				expect(transport.get.calls.count()).toEqual(1);
				transport.getResolve({ status: 204, response: "test"});

				var getSpy = jasmine.createSpy("getSpy");
				getPromise.then(getSpy)

				tick(function() {
					expect(getSpy.calls.count()).toEqual(1);
					expect(getSpy.calls.argsFor(0)).toEqual([{ status: 204, response: "test"}]);

					done();
				});
			});
		})
	});

	it("waits for a promise that is rejected", (done) => {
		transportQueue = new TransportQueue(transport);
		expect(transportQueue.isQueueing).toEqual(false);

		var waitingForPromiseResolve;
		transportQueue.waitFor(new Promise(function(resolve, reject) {
			waitingForPromiseResolve = resolve;
		}));

		var getPromise = transportQueue.get();
		tick(function() {
			expect(transport.get.calls.count()).toEqual(0);
			waitingForPromiseResolve();
			tick(function() {
				expect(transport.get.calls.count()).toEqual(1);
				transport.getReject();

				var getSpy = jasmine.createSpy("getSpy");
				getPromise.catch(getSpy)

				tick(function() {
					expect(getSpy.calls.count()).toEqual(1);
					expect(getSpy.calls.argsFor(0)).toEqual([undefined]);
					done();
				});
			});
		})
	});

	it("waits for a auth that isn't ready when constructed", (done) => {
		transportQueue = new TransportQueue(transport, transportAuth);
		expect(transportQueue.isQueueing).toEqual(true);

		transportQueue.get();
		tick(function() {
			expect(transport.get.calls.count()).toEqual(0);

			transportAuth.auth.setExpiry(Date.now() + 10000);
			transportAuth.trigger(transportAuth.EVENT_TOKEN_RECEIVED);

			tick(function() {
				expect(transport.get.calls.count()).toEqual(1);
				done();
			});
		})
	});

	it("doesn't wait if the expiry is in the future", (done) => {
		transportAuth.auth.setExpiry(Date.now() + 10000);
		transportQueue = new TransportQueue(transport, transportAuth);
		expect(transportQueue.isQueueing).toEqual(false);

		transportQueue.get();
		tick(function() {
			expect(transport.get.calls.count()).toEqual(1);
			done();
		})
	});

	it("starts queuing if the expiry goes into the past", (done) => {
		transportAuth.auth.setExpiry(Date.now() + 10000);
		transportQueue = new TransportQueue(transport, transportAuth);
		expect(transportQueue.isQueueing).toEqual(false);

		transportAuth.auth.setExpiry(Date.now() - 1);
		transportQueue.get();
		expect(transportAuth.onTokenInvalid.calls.count()).toEqual(1);
		tick(function() {
			expect(transport.get.calls.count()).toEqual(0);
			done();
		})
	});

	it("doesn't resolve if a promise resolves but the expiry is still in the past", (done) => {
		transportAuth.auth.setExpiry(Date.now() + 10000);
		transportQueue = new TransportQueue(transport, transportAuth);
		expect(transportQueue.isQueueing).toEqual(false);

		var waitingForPromiseResolve;
		transportQueue.waitFor(new Promise(function(resolve, reject) {
			waitingForPromiseResolve = resolve;
		}));

		expect(transportQueue.isQueueing).toEqual(true);

		transportQueue.get();

		transportAuth.auth.setExpiry(Date.now() - 1);
		waitingForPromiseResolve();

		tick(function() {
			expect(transport.get.calls.count()).toEqual(0);
			done();
		})
	});

	it("if a call comes back with a 401, then queue it up till auth comes in", (done) => {
		transportAuth.auth.setExpiry(Date.now() + 1);
		transportQueue = new TransportQueue(transport, transportAuth);
		expect(transportQueue.isQueueing).toEqual(false);

		var getPromise1 = transportQueue.get();
		var getReject1 = transport.getReject;
		var getPromise2 = transportQueue.get();
		var getReject2 = transport.getReject;

		var getSpy1 = jasmine.createSpy("get1");
		getPromise1.then(getSpy1);
		var getSpy2 = jasmine.createSpy("get2");
		getPromise2.then(getSpy2);

		jasmine.clock().tick(2);

		getReject1({ status: 401 });
		getReject2({ status: 401 });

		tick(function() {

			expect(getSpy1.calls.count()).toEqual(0);
			expect(getSpy2.calls.count()).toEqual(0);
			expect(transportQueue.isQueueing).toEqual(true);
			transport.get.calls.reset();

			transportAuth.auth.setExpiry(Date.now() + 10);
			transportAuth.trigger(transportAuth.EVENT_TOKEN_RECEIVED);
			expect(transport.get.calls.count()).toEqual(2);

			done();
		})
	});

	it("disposes okay", () => {
		transportQueue = new TransportQueue(transport);
		transportQueue.get();
		transportQueue.get();
		transportQueue.dispose();
		expect(transportQueue.queue).toEqual([]);
		expect(transport.dispose.calls.count()).toEqual(1);
		transport.dispose.calls.reset();

		transportQueue = new TransportQueue(transport, transportAuth);
		transportQueue.get();
		transportQueue.get();
		transportQueue.dispose();
		expect(transport.dispose.calls.count()).toEqual(1);
	});
});
