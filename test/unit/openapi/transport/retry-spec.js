var transport;
var transportRetry;

import { tick, installClock, uninstallClock, global } from '../../utils';
import mockTransport from '../../mocks/transport';

const TransportRetry = saxo.openapi.TransportRetry;

describe("openapi TransportRetry", () => {
    beforeEach(() => {
        transport = mockTransport();
        installClock();
    });

    afterEach(function() {
        uninstallClock();
    });

    it("does not require options", () => {
        expect(function() {
            transportRetry = new TransportRetry(transport);
        }).not.toThrow();
    });

    it("defaults to not retrying failed calls", (done) => {
        transportRetry = new TransportRetry(transport);
        expect(transport.get.calls.count()).toEqual(0);
        expect(transportRetry.retryTimeout).toEqual(0);
        expect(transportRetry.methods).toEqual({});
        var getPromise  = transportRetry.get();
        tick(() => {
            expect(transport.get.calls.count()).toEqual(1);

            expect(getPromise).toBeDefined();
            expect(typeof getPromise.then).toBe("function")
            transport.getReject({ status: 404, response: "test"});
            var isRejected = false;
            getPromise.catch(() => {
                isRejected = true;
            });
            tick(() => {
                expect(isRejected).toEqual(true);
                done();
            });
        });
    });

    it("does not retry a successful call", (done) => {
        transportRetry = new TransportRetry(transport, {retryTimeout:10000, methods:{'delete':{retryLimit:3}}});
        var deletePromise = transportRetry.delete();
        expect(transport.delete.calls.count()).toEqual(1);
        transport.deleteResolve({ status: 200, response: "test"});
        tick(function() {
            var isResolved = false;
            deletePromise.then(() => {
                isResolved = true;
            });
            tick(() => {
                expect(isResolved).toEqual(true);
                done();
            });
        });
    });

    it("does not retry a failed call for a method not configured in options", (done) => {
        transportRetry = new TransportRetry(transport, {retryTimeout:10000, methods:{'delete':{retryLimit:3}}});

        var postPromise = transportRetry.post();
        tick(function() {
            expect(transport.post.calls.count()).toEqual(1);
            transport.postReject({ status: 404, response: "test"});
            var isRejected = false;
            postPromise.catch(() => {
                isRejected = true;
            });
            tick(() => {
                expect(isRejected).toEqual(true);
                done();
            });
        });
    });

    it("stops retrying after a successful call", (done) => {
        transportRetry = new TransportRetry(transport, {retryTimeout:2000, methods:{'delete':{retryLimit:3}}});
        var deletePromise = transportRetry.delete();
        tick(() => {
            expect(transport.delete.calls.count()).toEqual(1);
            transport.deleteReject({ status: 404, response: "test"});
            var isResolved = false;
            deletePromise.then(() => {
                isResolved = true;
            });
            tick(() => {
                //1st retry
                expect(transportRetry.failedCalls.length).toEqual(1);
                expect(transport.delete.calls.count()).toEqual(1);
                jasmine.clock().tick(2000);  // now go forward 2 seconds
                //retry success
                transport.deleteResolve({ status: 200, response: "test"});

                tick(() => {
                    //no 2nd retry
                    expect(isResolved).toEqual(true);
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    jasmine.clock().tick(2000);  // now go forward 2 seconds
                    expect(transport.delete.calls.count()).toEqual(2);
                    done();
                });
            });
        });
    });

    it("retries a failed call according to options", (done) => {
        transportRetry = new TransportRetry(transport, {retryTimeout:2000, methods:{'delete':{retryLimit:3}}});
        expect(transportRetry.retryTimeout).toEqual(2000);
        var deletePromise = transportRetry.delete();
        var isRejected = false;
        deletePromise.catch(() => {
            isRejected = true;
        });
        tick(() => {
            expect(transport.delete.calls.count()).toEqual(1);
            transport.deleteReject({ status: 404, response: "test"});
            tick(() => {
                //1st retry
                expect(transportRetry.failedCalls.length).toEqual(1);
                expect(transportRetry.retryTimer).toBeDefined(); //the timer is set
                jasmine.clock().tick(2000);  // now go forward 2 seconds
                expect(transport.delete.calls.count()).toEqual(2);
                expect(transportRetry.retryTimer).toBeNull(); //the timer is unset
                transport.deleteReject({ status: 404, response: "test"});

                tick(() => {
                    //2nd retry
                    expect(transportRetry.failedCalls.length).toEqual(1);
                    expect(transportRetry.retryTimer).toBeDefined(); //the timer is set
                    jasmine.clock().tick(2000);  // now go forward 2 seconds
                    expect(transport.delete.calls.count()).toEqual(3);
                    expect(transportRetry.retryTimer).toBeNull(); //the timer is unset
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    transport.deleteReject({ status: 404, response: "test"});

                    tick(() => {
                        //3rd retry
                        expect(transportRetry.failedCalls.length).toEqual(1);
                        expect(transportRetry.retryTimer).toBeDefined(); //the timer is set
                        jasmine.clock().tick(2000);  // now go forward 2 seconds
                        expect(transport.delete.calls.count()).toEqual(4); //4 delete calls in total
                        expect(transportRetry.retryTimer).toBeNull(); //the timer is unset
                        expect(transportRetry.failedCalls.length).toEqual(0);
                        transport.deleteReject({ status: 404, response: "test"});

                        tick(() => {
                            //no more retries after 3rd retry failed
                            expect(isRejected).toEqual(true);
                            expect(transportRetry.failedCalls.length).toEqual(0);// failedCalls is empty
                            expect(transportRetry.retryTimer).toBeNull(); //the timer is unset
                            jasmine.clock().tick(2000);  // now go forward 2 seconds
                            expect(transport.delete.calls.count()).toEqual(4); //4 delete calls in total
                            expect(transportRetry.failedCalls.length).toEqual(0);
                            done();
                        });
                    });
                });
            });
        });
    });
});