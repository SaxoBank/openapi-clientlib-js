import { setTimeout, installClock, uninstallClock, tick } from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import TransportRetry from './retry';

describe('openapi TransportRetry', () => {

    let transport;
    let transportRetry;

    beforeEach(() => {
        transport = mockTransport();
        installClock();
    });

    afterEach(function() {
        uninstallClock();
    });

    it('does not require options', () => {
        expect(function() {
            transportRetry = new TransportRetry(transport);
        }).not.toThrow();
    });

    it('defaults to not retrying failed calls', (done) => {
        transportRetry = new TransportRetry(transport);
        expect(transport.get.mock.calls.length).toEqual(0);
        expect(transportRetry.retryTimeout).toEqual(0);
        expect(transportRetry.methods).toEqual({});
        const getPromise = transportRetry.get();
        setTimeout(() => {
            expect(transport.get.mock.calls.length).toEqual(1);

            expect(getPromise).toBeDefined();
            expect(typeof getPromise.then).toBe('function');
            transport.getReject({ status: 404, response: 'test' });
            let isRejected = false;
            getPromise.catch(() => {
                isRejected = true;
            });
            setTimeout(() => {
                expect(isRejected).toEqual(true);
                done();
            });
        });
    });

    it('passes failed api response in reject callback as params', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 1 } } });
        expect(transportRetry.retryTimeout).toEqual(2000);
        const deletePromise = transportRetry.delete();
        let apiResponse;
        deletePromise.catch((response) => {
            apiResponse = response;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('First Network request failed'));
            setTimeout(() => {
                // 1st retry
                expect(transportRetry.failedCalls.length).toEqual(1);
                expect(transportRetry.retryTimer).toBeDefined(); // the timer is set
                tick(2000); // now go forward 2 seconds
                expect(transport.delete.mock.calls.length).toEqual(2);
                expect(transportRetry.retryTimer).toBeNull(); // the timer is unset
                const errorResponse = new TypeError('Seconed Network request failed');
                transport.deleteReject(errorResponse);
                setTimeout(() => {
                    expect(apiResponse).toEqual(errorResponse);
                    done();
                });
            });
        });
    });

    it('does not retry a successful call', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 10000, methods: { 'delete': { retryLimit: 3 } } });
        const deletePromise = transportRetry.delete();
        expect(transport.delete.mock.calls.length).toEqual(1);
        transport.deleteResolve({ status: 200, response: 'test' });
        setTimeout(function() {
            let isResolved = false;
            deletePromise.then(() => {
                isResolved = true;
            });
            setTimeout(() => {
                expect(isResolved).toEqual(true);
                done();
            });
        });
    });

    it('does not retry a failed call for a method not configured in options', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 10000, methods: { 'delete': { retryLimit: 3 } } });

        const postPromise = transportRetry.post();
        setTimeout(function() {
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.postReject({ status: 404, response: 'test' });
            let isRejected = false;
            postPromise.catch(() => {
                isRejected = true;
            });
            setTimeout(() => {
                expect(isRejected).toEqual(true);
                done();
            });
        });
    });

    it('stops retrying after a successful call', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 3 } } });
        const deletePromise = transportRetry.delete();
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('Network request failed'));
            let isResolved = false;
            deletePromise.then(() => {
                isResolved = true;
            });
            setTimeout(() => {
                // 1st retry
                expect(transportRetry.failedCalls.length).toEqual(1);
                expect(transport.delete.mock.calls.length).toEqual(1);
                tick(2000); // now go forward 2 seconds
                // retry success
                transport.deleteResolve({ status: 200, response: 'test' });

                setTimeout(() => {
                    // no 2nd retry
                    expect(isResolved).toEqual(true);
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    tick(2000); // now go forward 2 seconds
                    expect(transport.delete.mock.calls.length).toEqual(2);
                    done();
                });
            });
        });
    });

    it('retries a failed call according to options respecting retryTimeout and retryLimit options', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 3 } } });
        expect(transportRetry.retryTimeout).toEqual(2000);
        const deletePromise = transportRetry.delete();
        let isRejected = false;
        deletePromise.catch(() => {
            isRejected = true;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('Network request failed'));
            setTimeout(() => {
                // 1st retry
                expect(transportRetry.failedCalls.length).toEqual(1);
                expect(transportRetry.retryTimer).toBeDefined(); // the timer is set
                tick(2000); // now go forward 2 seconds
                expect(transport.delete.mock.calls.length).toEqual(2);
                expect(transportRetry.retryTimer).toBeNull(); // the timer is unset
                transport.deleteReject(new TypeError('Network request failed'));

                setTimeout(() => {
                    // 2nd retry
                    expect(transportRetry.failedCalls.length).toEqual(1);
                    expect(transportRetry.retryTimer).toBeDefined(); // the timer is set
                    tick(2000); // now go forward 2 seconds
                    expect(transport.delete.mock.calls.length).toEqual(3);
                    expect(transportRetry.retryTimer).toBeNull(); // the timer is unset
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    transport.deleteReject(new TypeError('Network request failed'));

                    setTimeout(() => {
                        // 3rd retry
                        expect(transportRetry.failedCalls.length).toEqual(1);
                        expect(transportRetry.retryTimer).toBeDefined(); // the timer is set
                        tick(2000); // now go forward 2 seconds
                        expect(transport.delete.mock.calls.length).toEqual(4); // 4 delete calls in total
                        expect(transportRetry.retryTimer).toBeNull(); // the timer is unset
                        expect(transportRetry.failedCalls.length).toEqual(0);
                        transport.deleteReject(new TypeError('Network request failed'));

                        setTimeout(() => {
                            // no more retries after 3rd retry failed
                            expect(isRejected).toEqual(true);
                            expect(transportRetry.failedCalls.length).toEqual(0);// failedCalls is empty
                            expect(transportRetry.retryTimer).toBeNull(); // the timer is unset
                            tick(2000); // now go forward 2 seconds
                            expect(transport.delete.mock.calls.length).toEqual(4); // 4 delete calls in total
                            expect(transportRetry.failedCalls.length).toEqual(0);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('retries a failed call according to options respecting retryTimeouts option', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryTimeouts: [1000, 2000, 5000] } } });
        expect(transportRetry.methods['delete'].retryTimeouts.length).toEqual(3);
        const deletePromise = transportRetry.delete();
        let isRejected = false;
        deletePromise.catch(() => {
            isRejected = true;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('Network request failed'));
            setTimeout(() => {
                // 1st retry
                expect(transportRetry.individualFailedCalls.length).toEqual(1);
                expect(transportRetry.failedCalls.length).toEqual(0);
                expect(transportRetry.retryTimer).toBeNull(); // the global timer is not needed for a custom retry
                const call1 = transportRetry.individualFailedCalls[0];
                expect(call1.retryTimer).toBeDefined(); // the individual timer is set
                tick(1000);
                expect(transport.delete.mock.calls.length).toEqual(2);
                expect(transportRetry.retryTimer).toBeNull(); // the global timer is still unset
                expect(call1.retryTimer); // the individual timer is unset
                expect(transportRetry.individualFailedCalls.length).toEqual(0);
                transport.deleteReject(new TypeError('Network request failed'));

                setTimeout(() => {
                    // 2nd retry
                    expect(transportRetry.individualFailedCalls.length).toEqual(1);
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    expect(transportRetry.retryTimer).toBeNull();
                    const call2 = transportRetry.individualFailedCalls[0];
                    expect(call2.retryTimer).toBeDefined();
                    tick(2000); // now go forward 2 seconds
                    expect(transport.delete.mock.calls.length).toEqual(3);
                    expect(transportRetry.retryTimer).toBeNull(); // the global timer is still unset
                    expect(call2.retryTimer); // the individual timer is unset
                    expect(transportRetry.individualFailedCalls.length).toEqual(0);
                    transport.deleteReject(new TypeError('Network request failed'));

                    setTimeout(() => {
                        // 3rd retry
                        expect(transportRetry.individualFailedCalls.length).toEqual(1);
                        expect(transportRetry.failedCalls.length).toEqual(0);
                        expect(transportRetry.retryTimer).toBeNull();
                        const call3 = transportRetry.individualFailedCalls[0];
                        expect(call3.retryTimer).toBeDefined();
                        tick(5000); // now go forward 5 seconds
                        expect(transport.delete.mock.calls.length).toEqual(4); // 4 delete calls in total
                        expect(transportRetry.retryTimer).toBeNull(); // the global timer is still unset
                        expect(call3.retryTimer); // the individual timer is unset
                        expect(transportRetry.individualFailedCalls.length).toEqual(0);
                        transport.deleteReject(new TypeError('Network request failed'));

                        setTimeout(() => {
                            // no more retries after 3rd retry failed
                            expect(isRejected).toEqual(true);
                            expect(transportRetry.individualFailedCalls.length).toEqual(0);// failedCalls is empty
                            expect(transportRetry.retryTimer).toBeNull(); // the global timer is unset
                            tick(10000); // now go forward 10 seconds
                            expect(transport.delete.mock.calls.length).toEqual(4); // 4 delete calls in total
                            expect(transportRetry.individualFailedCalls.length).toEqual(0);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('retries multiple failed calls respecting individual options', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 3 }, 'post': { retryTimeouts: [1000, 2000] } } });
        const deletePromise = transportRetry.delete();
        const postPromise = transportRetry.post();
        let isDeleteRejected = false;
        deletePromise.catch(() => {
            isDeleteRejected = true;
        });
        let isPostRejected = false;
        postPromise.catch(() => {
            isPostRejected = true;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('Network request failed'));
            transport.postReject(new TypeError('Network request failed'));
            setTimeout(() => {
                // 1st post retry
                expect(transportRetry.individualFailedCalls.length).toEqual(1); // contain the post call
                expect(transportRetry.failedCalls.length).toEqual(1); // only contain the delete call
                expect(transportRetry.retryTimer).toBeDefined(); // the global timer is set
                tick(1000);
                expect(transport.post.mock.calls.length).toEqual(2);
                expect(transportRetry.retryTimer).toBeDefined(); // the global timer is still set
                expect(transportRetry.individualFailedCalls.length).toEqual(0);
                expect(transportRetry.failedCalls.length).toEqual(1); // still contain the delete call
                transport.postReject(new TypeError('Network request failed'));

                setTimeout(() => {
                    // 1st delete retry
                    expect(transportRetry.individualFailedCalls.length).toEqual(1);
                    expect(transportRetry.failedCalls.length).toEqual(1);
                    expect(transportRetry.retryTimer).toBeDefined(); // the global timer is still set for the delete call
                    tick(1000); // go forward 1 more second to trigger delete retry
                    expect(transport.delete.mock.calls.length).toEqual(2);
                    expect(transportRetry.retryTimer).toBeNull(); // the global timer is unset
                    expect(transportRetry.individualFailedCalls.length).toEqual(1); // only contain the post call
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    transport.deleteReject(new TypeError('Network request failed'));

                    setTimeout(() => {
                        // 2nd post retry
                        expect(transportRetry.individualFailedCalls.length).toEqual(1);
                        expect(transportRetry.failedCalls.length).toEqual(1);
                        expect(transportRetry.retryTimer).toBeDefined();
                        tick(1000); // go forward 1 second to trigger post retry
                        expect(transport.post.mock.calls.length).toEqual(3); // 3 post calls in total
                        expect(transportRetry.retryTimer).toBeDefined(); // the global timer is still set for the delete call
                        expect(transportRetry.individualFailedCalls.length).toEqual(0);
                        expect(transportRetry.failedCalls.length).toEqual(1); // only contain the delete call

                        expect(isDeleteRejected).toEqual(false);
                        expect(isPostRejected).toEqual(false);

                        done();
                    });
                });
            });
        });
    });

    it('does not retry rejected calls with a valid status code', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 3 } } });
        const deletePromise = transportRetry.delete();
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject({ status: 404, response: 'test' });
            let isRejected = false;
            deletePromise.catch(() => {
                isRejected = true;
            });
            setTimeout(() => {
                expect(isRejected).toEqual(true);
                tick(2000);
                expect(transportRetry.failedCalls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(1);
                done();
            });
        });
    });

    it('retries a rejected call with a status code given in statuses option', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 2000, methods: { 'delete': { retryLimit: 3, statuses: [504] } } });
        const deletePromise = transportRetry.delete();
        let isRejected = false;
        deletePromise.catch(() => {
            isRejected = true;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.deleteReject({ status: 504, response: 'test' });
            setTimeout(() => {
                expect(isRejected).toEqual(false);
                expect(transportRetry.failedCalls.length).toEqual(1);
                tick(2000);
                expect(transportRetry.failedCalls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(2);
                done();
            });
        });
    });

    it('stops retrying and rejects outstanding promises after transport was disposed', (done) => {
        transportRetry = new TransportRetry(transport, { retryTimeout: 1000, methods: { 'delete': { retryLimit: 3 }, 'post': { retryTimeouts: [1000, 2000] } } });
        const deletePromise = transportRetry.delete();
        const postPromise = transportRetry.post();
        let isDeleteRejected = false;
        deletePromise.catch(() => {
            isDeleteRejected = true;
        });
        let isPostRejected = false;
        postPromise.catch(() => {
            isPostRejected = true;
        });
        setTimeout(() => {
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.deleteReject(new TypeError('Network request failed'));
            transport.postReject(new TypeError('Network request failed'));
            setTimeout(() => {
                expect(transportRetry.individualFailedCalls.length).toEqual(1); // contain the post call
                expect(transportRetry.failedCalls.length).toEqual(1); // contain the delete call
                expect(transportRetry.retryTimer).toBeDefined(); // the global timer is set
                const call1 = transportRetry.individualFailedCalls[0];
                expect(call1.retryTimer).toBeDefined(); // the individual timer is set

                transportRetry.dispose();

                setTimeout(() => {
                    // promises rejected, no more retries
                    expect(isDeleteRejected).toEqual(true);
                    expect(isPostRejected).toEqual(true);
                    expect(transportRetry.individualFailedCalls.length).toEqual(0);
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    tick(2000);
                    expect(transportRetry.individualFailedCalls.length).toEqual(0);
                    expect(transportRetry.failedCalls.length).toEqual(0);
                    done();
                });
            });
        });
    });
});
