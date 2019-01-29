import { setTimeout, installClock, uninstallClock, tick } from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import mockTransportAuth from '../../test/mocks/transport-auth';
import TransportQueue from './queue';

describe('openapi TransportQueue', () => {

    let transport;
    let transportQueue;
    let transportAuth;

    beforeEach(() => {
        transport = mockTransport();
        transportAuth = mockTransportAuth();
        installClock();
    });
    afterEach(function() {
        uninstallClock();
    });

    it('does not require options', () => {
        expect(function() {
            transportQueue = new TransportQueue(transport);
        }).not.toThrow();
    });

    it('defaults to not queuing', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);
        expect(transport.get.mock.calls.length).toEqual(0);

        transportQueue.get();
        setTimeout(() => {
            expect(transport.get.mock.calls.length).toEqual(1);
            done();
        });
    });

    it('waits for a promise that is fullfilled', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve;
        transportQueue.waitFor(new Promise(function(resolve, reject) {
            waitingForPromiseResolve = resolve;
        }));

        const getPromise = transportQueue.get();
        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(0);
            waitingForPromiseResolve();
            setTimeout(function() {
                expect(transport.get.mock.calls.length).toEqual(1);
                transport.getResolve({ status: 204, response: 'test' });

                const getSpy = jest.fn().mockName('getSpy');
                getPromise.then(getSpy);

                setTimeout(function() {
                    expect(getSpy.mock.calls.length).toEqual(1);
                    expect(getSpy.mock.calls[0]).toEqual([{ status: 204, response: 'test' }]);

                    done();
                });
            });
        });
    });

    it('waits for a promise that is rejected', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve;
        transportQueue.waitFor(new Promise(function(resolve, reject) {
            waitingForPromiseResolve = resolve;
        }));

        const getPromise = transportQueue.get();
        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(0);
            waitingForPromiseResolve();
            setTimeout(function() {
                expect(transport.get.mock.calls.length).toEqual(1);
                transport.getReject();

                const getSpy = jest.fn().mockName('getSpy');
                getPromise.catch(getSpy);

                setTimeout(function() {
                    expect(getSpy.mock.calls.length).toEqual(1);
                    expect(getSpy.mock.calls[0]).toEqual([undefined]);
                    done();
                });
            });
        });
    });

    it('waits for a auth that isn\'t ready when constructed', (done) => {
        transportQueue = new TransportQueue(transport, transportAuth);
        expect(transportQueue.isQueueing).toEqual(true);

        transportQueue.get();
        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(0);

            transportAuth.auth.setExpiry(Date.now() + 10000);
            transportAuth.trigger(transportAuth.EVENT_TOKEN_RECEIVED);

            setTimeout(function() {
                expect(transport.get.mock.calls.length).toEqual(1);
                done();
            });
        });
    });

    it('doesn\'t wait if the expiry is in the future', (done) => {
        transportAuth.auth.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, transportAuth);
        expect(transportQueue.isQueueing).toEqual(false);

        transportQueue.get();
        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(1);
            done();
        });
    });

    it('starts queuing if the expiry goes into the past', (done) => {
        transportAuth.auth.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, transportAuth);
        expect(transportQueue.isQueueing).toEqual(false);

        transportAuth.auth.setExpiry(Date.now() - 1);
        transportQueue.get();
        expect(transportAuth.checkAuthExpiry.mock.calls.length).toEqual(1);
        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(0);
            done();
        });
    });

    it('doesn\'t resolve if a promise resolves but the expiry is still in the past', (done) => {
        transportAuth.auth.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, transportAuth);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve;
        transportQueue.waitFor(new Promise(function(resolve, reject) {
            waitingForPromiseResolve = resolve;
        }));

        expect(transportQueue.isQueueing).toEqual(true);

        transportQueue.get();

        transportAuth.auth.setExpiry(Date.now() - 1);
        waitingForPromiseResolve();

        setTimeout(function() {
            expect(transport.get.mock.calls.length).toEqual(0);
            done();
        });
    });

    it('if a call comes back with a 401, then queue it up till auth comes in', (done) => {
        transportAuth.auth.setExpiry(Date.now() + 1);
        transportQueue = new TransportQueue(transport, transportAuth);
        expect(transportQueue.isQueueing).toEqual(false);

        const getPromise1 = transportQueue.get();
        const getReject1 = transport.getReject;
        const getPromise2 = transportQueue.get();
        const getReject2 = transport.getReject;

        const getSpy1 = jest.fn().mockName('get1');
        getPromise1.then(getSpy1);
        const getSpy2 = jest.fn().mockName('get2');
        getPromise2.then(getSpy2);

        tick(2);

        getReject1({ status: 401 });
        getReject2({ status: 401 });

        setTimeout(function() {

            expect(getSpy1.mock.calls.length).toEqual(0);
            expect(getSpy2.mock.calls.length).toEqual(0);
            expect(transportQueue.isQueueing).toEqual(true);
            transport.get.mockClear();

            transportAuth.auth.setExpiry(Date.now() + 10);
            transportAuth.trigger(transportAuth.EVENT_TOKEN_RECEIVED);
            expect(transport.get.mock.calls.length).toEqual(2);

            done();
        });
    });

    it('disposes okay', () => {
        transportQueue = new TransportQueue(transport);
        transportQueue.get();
        transportQueue.get();
        transportQueue.dispose();
        expect(transportQueue.queue).toEqual([]);
        expect(transport.dispose.mock.calls.length).toEqual(1);
        transport.dispose.mockClear();

        transportQueue = new TransportQueue(transport, transportAuth);
        transportQueue.get();
        transportQueue.get();
        transportQueue.dispose();
        expect(transport.dispose.mock.calls.length).toEqual(1);
    });
});
