import {
    setTimeout,
    installClock,
    uninstallClock,
    tick,
} from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import mockAuthProvider from '../../test/mocks/authProvider';
import TransportQueue from './queue';

describe('openapi TransportQueue', () => {
    let transport: any;
    let transportQueue: TransportQueue;
    // this authProvider is a mockImplementation and have few methods different then
    let authProvider: any;

    beforeEach(() => {
        transport = mockTransport();
        authProvider = mockAuthProvider();
        installClock();
    });
    afterEach(function () {
        uninstallClock();
    });

    it('does not require options', () => {
        expect(function () {
            transportQueue = new TransportQueue(transport);
        }).not.toThrow();
    });

    it('defaults to not queuing', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);
        expect(transport.get.mock.calls.length).toEqual(0);

        transportQueue.get('foo', 'bar');
        setTimeout(() => {
            expect(transport.get.mock.calls.length).toEqual(1);
            done();
        });
    });

    it('waits for a promise that is fullfilled', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve: (value?: any) => void;
        transportQueue.waitFor(
            new Promise(function (resolve) {
                waitingForPromiseResolve = resolve;
            }),
        );

        const getPromise = transportQueue.get('foo', 'bar');
        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(0);
            waitingForPromiseResolve();
            setTimeout(function () {
                expect(transport.get.mock.calls.length).toEqual(1);
                transport.getResolve({ status: 204, response: 'test' });

                const getSpy = jest.fn().mockName('getSpy');
                getPromise.then(getSpy);

                // eslint-disable-next-line max-nested-callbacks
                setTimeout(function () {
                    expect(getSpy.mock.calls.length).toEqual(1);
                    expect(getSpy.mock.calls[0]).toEqual([
                        { status: 204, response: 'test' },
                    ]);

                    done();
                });
            });
        });
    });

    it('waits for a promise that is rejected', (done) => {
        transportQueue = new TransportQueue(transport);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve: (value?: any) => void;
        transportQueue.waitFor(
            new Promise(function (resolve) {
                waitingForPromiseResolve = resolve;
            }),
        );

        const getPromise = transportQueue.get('foo', 'bar');
        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(0);
            waitingForPromiseResolve();
            setTimeout(function () {
                expect(transport.get.mock.calls.length).toEqual(1);
                transport.getReject();

                const getSpy = jest.fn().mockName('getSpy');
                getPromise.catch(getSpy);

                setTimeout(function () {
                    expect(getSpy.mock.calls.length).toEqual(1);
                    expect(getSpy.mock.calls[0]).toEqual([undefined]);
                    done();
                });
            });
        });
    });

    it("waits for a auth that isn't ready when constructed", (done) => {
        authProvider.setExpiry(Date.now() - 10000);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(true);

        transportQueue.get('foo', 'bar');
        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(0);

            authProvider.setExpiry(Date.now() + 10000);
            authProvider.triggerTokenReceived();

            setTimeout(function () {
                expect(transport.get.mock.calls.length).toEqual(1);
                done();
            });
        });
    });

    it("doesn't wait if the expiry is in the future", (done) => {
        authProvider.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(false);

        transportQueue.get('foo', 'bar');
        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(1);
            done();
        });
    });

    it('starts queuing if the expiry goes into the past', (done) => {
        authProvider.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(false);

        authProvider.setExpiry(Date.now() - 1);
        transportQueue.get('foo', 'bar');
        expect(authProvider.refreshOpenApiToken).toHaveBeenCalledTimes(1);
        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(0);
            done();
        });
    });

    it("doesn't resolve if a promise resolves but the expiry is still in the past", (done) => {
        authProvider.setExpiry(Date.now() + 10000);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(false);

        let waitingForPromiseResolve: (value?: any) => void;
        transportQueue.waitFor(
            new Promise(function (resolve) {
                waitingForPromiseResolve = resolve;
            }),
        );

        expect(transportQueue.isQueueing).toEqual(true);

        transportQueue.get('foo', 'bar');

        authProvider.setExpiry(Date.now() - 1);
        // @ts-ignore
        waitingForPromiseResolve();

        setTimeout(function () {
            expect(transport.get.mock.calls.length).toEqual(0);
            done();
        });
    });

    it('if a call comes back with a 401, then queue it up till auth comes in', (done) => {
        authProvider.setExpiry(Date.now() + 1);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(false);

        const getPromise1 = transportQueue.get('foo', 'bar');
        const getReject1 = transport.getReject;
        const getPromise2 = transportQueue.get('foo', 'bar');
        const getReject2 = transport.getReject;

        const getSpy1 = jest.fn().mockName('get1');
        getPromise1.then(getSpy1);
        const getSpy2 = jest.fn().mockName('get2');
        getPromise2.then(getSpy2);

        tick(2);

        getReject1({ status: 401 });
        getReject2({ status: 401 });

        authProvider.isFetchingNewToken.mockReturnValue(true);

        setTimeout(function () {
            expect(getSpy1.mock.calls.length).toEqual(0);
            expect(getSpy2.mock.calls.length).toEqual(0);
            expect(transportQueue.isQueueing).toEqual(true);
            transport.get.mockClear();

            authProvider.setExpiry(Date.now() + 10);
            authProvider.triggerTokenReceived();
            expect(transport.get.mock.calls.length).toEqual(2);

            done();
        });
    });

    it('if a call comes back with a 401, then rerun straight away if not fetching a token', (done) => {
        authProvider.setExpiry(Date.now() + 1);
        transportQueue = new TransportQueue(transport, authProvider);
        expect(transportQueue.isQueueing).toEqual(false);

        const getPromise1 = transportQueue.get('foo', 'bar');
        const getReject1 = transport.getReject;
        const getPromise2 = transportQueue.get('foo', 'bar');
        const getReject2 = transport.getReject;

        const getSpy1 = jest.fn().mockName('get1');
        getPromise1.then(getSpy1);
        const getSpy2 = jest.fn().mockName('get2');
        getPromise2.then(getSpy2);

        tick(2);

        getReject1({ status: 401 });
        getReject2({ status: 401 });

        setTimeout(function () {
            expect(getSpy1.mock.calls.length).toEqual(0);
            expect(getSpy2.mock.calls.length).toEqual(0);
            expect(transportQueue.isQueueing).toEqual(false);
            expect(transport.get.mock.calls.length).toEqual(2);

            done();
        });
    });

    it('disposes okay', () => {
        transportQueue = new TransportQueue(transport);
        transportQueue.get('foo', 'bar');
        transportQueue.get('foo', 'bar');
        transportQueue.dispose();
        expect(transportQueue.queue).toEqual([]);
        expect(transport.dispose.mock.calls.length).toEqual(1);
        transport.dispose.mockClear();

        transportQueue = new TransportQueue(transport, authProvider);
        transportQueue.get('foo', 'bar');
        transportQueue.get('foo', 'bar');
        transportQueue.dispose();
        expect(transport.dispose.mock.calls.length).toEqual(1);
    });
});
