import { setTimeout, installClock, uninstallClock, tick } from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import * as mockProtoPrice from '../../test/mocks/proto-price';
import protobuf from 'protobufjs/dist/protobuf';
import Subscription from './subscription';
import ParserProtobuf from './parser/parser-protobuf';
import ParserFacade from './parser/parser-facade';
import log from '../../log';

ParserFacade.addEngines({
    'application/x-protobuf': protobuf,
});

ParserFacade.addParsers({
    'application/x-protobuf': ParserProtobuf,
});

describe('openapi StreamingSubscription', () => {

    let transport;
    let updateSpy;
    let createdSpy;
    let errorSpy;
    let authManager;

    function sendInitialResponse(response) {
        if (!response) {
            response = { Snapshot: { Data: [1, 'fish', 3] } };
        }
        transport.postResolve({ status: '200', response });
    }

    beforeEach(() => {
        installClock();
        transport = mockTransport();
        updateSpy = jest.fn().mockName('update');
        createdSpy = jest.fn().mockName('create');
        errorSpy = jest.fn().mockName('error');
        authManager = { getAuth: jest.fn() };
        authManager.getAuth.mockImplementation(function() {
            return { token: 'TOKEN' };
        });
    });
    afterEach(function() {
        uninstallClock();
    });

    describe('unsubscribe by tag behaviour', () => {
        let subscription;

        beforeEach(() => {
            subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', { RefreshRate: 120 });
        });

        it('is ready for unsubscribe immediately if not yet subscribed', () => {
            subscription.onUnsubscribeByTagPending();
            expect(subscription.isReadyForUnsubscribeByTag()).toBe(true);
        });

        it('is ready for unsubscribe ready immediately if no actions pending', (done) => {
            subscription.onSubscribe();
            transport.postResolve();
            setTimeout(() => {
                subscription.onUnsubscribeByTagPending();
                expect(subscription.isReadyForUnsubscribeByTag()).toBe(true);
                done();
            });
        });

        it('is not ready for unsubscribe if subscription is pending', (done) => {
            subscription.onSubscribe();
            setTimeout(() => {
                subscription.onUnsubscribeByTagPending();
                expect(subscription.isReadyForUnsubscribeByTag()).toBe(false);
                done();
            });
        });
    });

    describe('options', () => {
        it('accepts a refresh rate', () => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', { RefreshRate: 120 });
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual(['serviceGroup', 'src/test/resource', null, expect.objectContaining({ body: expect.objectContaining({ RefreshRate: 120 }) })]);
        });
        it('has a minimum refresh rate', () => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', { RefreshRate: 1 });
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual(['serviceGroup', 'src/test/resource', null, expect.objectContaining({ body: expect.objectContaining({ RefreshRate: 100 }) })]);
        });

        it('accepts a top', () => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', { RefreshRate: 120, Top: 10 });
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual(['serviceGroup', 'src/test/resource?$top=10', null, expect.objectContaining({ body: expect.objectContaining({ RefreshRate: 120 }) })]);
        });
    });

    describe('initial snapshot', () => {
        it('handles snapshots containing an array of data ', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            setTimeout(() => {
                // the update function should be called once with all data
                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0]).toEqual([{ Data: [1, 'fish', 3] }, subscription.UPDATE_TYPE_SNAPSHOT]);
                done();
            });
        });

        it('handles snapshots containing a single datum', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            const initialResponse = { Snapshot: 'wibble' };
            sendInitialResponse(initialResponse);

            setTimeout(() => {
                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0]).toEqual(['wibble', subscription.UPDATE_TYPE_SNAPSHOT]);
                done();
            });
        });

        it('handles errors', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, null, errorSpy);
            subscription.onSubscribe();

            transport.postReject({ status: '401', response: { message: 'An error has occurred' } });

            setTimeout(() => {
                expect(errorSpy.mock.calls.length).toEqual(1);
                expect(errorSpy.mock.calls[0]).toEqual([{ status: '401', response: { message: 'An error has occurred' } }]);
                done();
            });
        });

        it('handles protobuf format errors fallback to json', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'test/resource', { Format: 'application/x-protobuf' }, createdSpy, null, errorSpy);
            subscription.onSubscribe();

            transport.postReject({ status: '404', response: { ErrorCode: 'UnsupportedSubscriptionFormat' } });

            transport.post.mockClear();

            setTimeout(() => {
                expect(errorSpy.mock.calls.length).toEqual(0);
                expect(subscription.subscriptionData.Format).toEqual('application/json');

                expect(transport.post.mock.calls.length).toEqual(1);
                expect(transport.post.mock.calls[0][3].body.Format).toEqual('application/json');

                done();
            });
        });

        it('catches exceptions thrown during initial update', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            updateSpy.mockImplementation(() => {
                throw new Error('Unhandled Exception');
            });

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            setTimeout(() => {

                expect(updateSpy.mock.calls.length).toEqual(1);

                const streamingData = { ReferenceId: subscription.referenceId, Data: [1, 3] };
                subscription.onStreamingData(streamingData);

                // check we have not artificiailly set the streaming state as unsubscribed
                expect(updateSpy.mock.calls.length).toEqual(2);

                done();
            });
        });
    });

    describe('streamed update', () => {
        let subscription;
        beforeEach((done) => {
            subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();
            sendInitialResponse({ Snapshot: { Data: [] } });
            setTimeout(() => {
                updateSpy.mockClear();
                done();
            });
        });

        it('handles updates with the correct referenceId', () => {
            const streamingData = { ReferenceId: subscription.referenceId, Data: [1, 3] };
            subscription.onStreamingData(streamingData);

            // the update function should be called once
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([streamingData, subscription.UPDATE_TYPE_DELTA]);
        });

        it('handles single-valued updates', () => {
            const streamingData = { ReferenceId: subscription.referenceId, Data: ['foo'] };
            subscription.onStreamingData(streamingData);

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([streamingData, subscription.UPDATE_TYPE_DELTA]);
        });

        it('handles single-valued updates in modify patch state', () => {

            const patchArgsDelta = { argsDelta: 'delta' };
            subscription.onModify({ args: 'test' }, { isPatch: true, patchArgsDelta });

            const streamingData = { ReferenceId: subscription.referenceId, Data: ['foo'] };
            subscription.onStreamingData(streamingData);

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([streamingData, subscription.UPDATE_TYPE_DELTA]);
        });

        it('catches exceptions thrown during updates', () => {
            updateSpy.mockImplementation(() => {
                throw new Error('Unhandled Exception');
            });

            expect(() => subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' }))
                .not.toThrowError();
        });

        it('handles an unsubscribe from streaming data callback', () => {
            updateSpy.mockImplementation(() => subscription.onUnsubscribe());

            subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });
            subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls.length).toEqual(1);
        });
    });

    describe('out of order behaviour', () => {
        it('handles getting a delta before an initial response', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            const streamingDelta = { ReferenceId: subscription.referenceId, Data: ['foo'] };
            subscription.onStreamingData(streamingDelta);

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            setTimeout(() => {

                expect(updateSpy.mock.calls.length).toEqual(2);
                expect(updateSpy.mock.calls[0]).toEqual([initialResponse.Snapshot, subscription.UPDATE_TYPE_SNAPSHOT]);
                expect(updateSpy.mock.calls[1]).toEqual([streamingDelta, subscription.UPDATE_TYPE_DELTA]);
                done();
            });
        });
        it('ignores updates when unsubscribed', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });
            expect(updateSpy.mock.calls.length).toEqual(0);

            subscription.onSubscribe();

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            setTimeout(() => {

                expect(updateSpy.mock.calls.length).toEqual(1);

                subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });

                expect(updateSpy.mock.calls.length).toEqual(2);

                subscription.onUnsubscribe();

                subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });

                expect(updateSpy.mock.calls.length).toEqual(2);

                done();
            });
        });
        it('ignores snapshot when unsubscribed', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();
            subscription.onUnsubscribe();

            subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: 'foo' });
            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            setTimeout(() => {
                expect(updateSpy.mock.calls.length).toEqual(0);
                done();
            });
        });
        it('throws an error if you subscribe when disposed', () => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();
            subscription.onUnsubscribe();
            subscription.dispose();

            expect(() => subscription.onSubscribe()).toThrow();
        });
    });

    describe('connection unavailable behaviour', () => {
        it('does not subscribe when the connection is unavailable', () => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onConnectionUnavailable();
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(0);
        });
        it('does not unsubscribe when the connection is unavailable', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);

            sendInitialResponse();

            setTimeout(() => {
                // now subscribed.

                subscription.onConnectionUnavailable();
                subscription.onUnsubscribe();

                expect(transport.delete.mock.calls.length).toEqual(0);

                subscription.onConnectionAvailable();
                expect(transport.delete.mock.calls.length).toEqual(1);

                done();
            });
        });
        it('does not unsubscribe if connection becomes unavailable whilst subscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();
            subscription.onConnectionUnavailable();
            subscription.onUnsubscribe();

            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse();

            setTimeout(() => {
                // now subscribed.
                expect(transport.delete.mock.calls.length).toEqual(0);

                subscription.onConnectionAvailable();

                expect(transport.delete.mock.calls.length).toEqual(1);

                done();
            });
        });
        it('does not subscribe if connection becomes unavailable whilst unsubscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();

            sendInitialResponse();

            setTimeout(() => {
                // now subscribed.

                subscription.onUnsubscribe();
                expect(transport.delete.mock.calls.length).toEqual(1);

                subscription.onConnectionUnavailable();
                subscription.onSubscribe();
                expect(transport.post.mock.calls.length).toEqual(0);

                transport.deleteResolve({ status: 200 });

                setTimeout(() => {
                    expect(transport.post.mock.calls.length).toEqual(0);

                    subscription.onConnectionAvailable();

                    expect(transport.post.mock.calls.length).toEqual(1);

                    done();
                });
            });
        });
        it('does not subscribe if connection becomes available whilst unsubscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();

            sendInitialResponse();

            setTimeout(() => {
                // now subscribed.

                subscription.onUnsubscribe();
                expect(transport.delete.mock.calls.length).toEqual(1);

                subscription.onConnectionUnavailable();
                subscription.onSubscribe();
                expect(transport.post.mock.calls.length).toEqual(0);

                subscription.onConnectionAvailable();
                expect(transport.post.mock.calls.length).toEqual(0);

                transport.deleteResolve({ status: 200 });

                setTimeout(() => {
                    expect(transport.post.mock.calls.length).toEqual(1);

                    done();
                });
            });
        });
    });

    describe('subscribe/unsubscribe queuing', () => {

        it('ignores multiple commands when already in the right state', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            jest.spyOn(log, 'error');

            subscription.onUnsubscribe();
            subscription.onUnsubscribe();
            subscription.onUnsubscribe();
            subscription.onUnsubscribe();

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onSubscribe(); // subscribing
            transport.post.mockClear();
            // waiting for subscribe to respond

            subscription.onSubscribe();
            subscription.onSubscribe();
            subscription.onSubscribe();
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse();
            setTimeout(() => {

                // now subscribed
                subscription.onSubscribe();
                subscription.onSubscribe();
                subscription.onSubscribe();
                subscription.onSubscribe();

                expect(transport.post.mock.calls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(0);

                subscription.onUnsubscribe(); // unsubscribing
                transport.delete.mockClear();
                // waiting for unsubscribe

                subscription.onUnsubscribe();
                subscription.onUnsubscribe();
                subscription.onUnsubscribe();
                subscription.onUnsubscribe();

                expect(transport.post.mock.calls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(0);

                transport.deleteResolve({ status: 200 });
                setTimeout(() => {
                    // now unsubscribed

                    subscription.onUnsubscribe();
                    subscription.onUnsubscribe();
                    subscription.onUnsubscribe();
                    subscription.onUnsubscribe();

                    expect(transport.post.mock.calls.length).toEqual(0);
                    expect(transport.delete.mock.calls.length).toEqual(0);

                    expect(log.error.mock.calls.length).toEqual(0);

                    done();
                });
            });
        });

        /**
         * Unsubscribe before subscribe is required for modify action.
          */
        it('accept unsubscribe followed by a subscribe when waiting for an action to respond', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            jest.spyOn(log, 'error');

            subscription.onSubscribe();
            transport.post.mockClear();
            // waiting for subscribe to respond

            subscription.onUnsubscribe();
            subscription.onSubscribe();

            sendInitialResponse();
            setTimeout(() => {

                expect(transport.post.mock.calls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(0);

                expect(log.error.mock.calls.length).toEqual(0);

                done();
            });
        });

        it('if an error occurs unsubscribing then it continues with the next action', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();

            sendInitialResponse();
            setTimeout(() => {
                subscription.onUnsubscribe();
                subscription.onSubscribe();

                transport.deleteReject();
                transport.post.mockClear();

                setTimeout(() => {
                    expect(transport.post.mock.calls.length).toEqual(1); // it does the subscribe after the unsubscribe fails
                    done();
                });
            });
        });

        it('ignores a subscribe followed by an unsubscribe when waiting for an action to respond', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            jest.spyOn(log, 'error');

            subscription.onSubscribe();
            transport.post.mockClear();

            sendInitialResponse();

            setTimeout(() => {

                subscription.onUnsubscribe();
                transport.delete.mockClear();
                // waiting for unsubscribe to occur

                subscription.onSubscribe();
                subscription.onUnsubscribe();

                expect(transport.post.mock.calls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(0);

                transport.deleteResolve({ status: 200 });

                setTimeout(() => {

                    expect(transport.post.mock.calls.length).toEqual(0);
                    expect(transport.delete.mock.calls.length).toEqual(0);

                    expect(log.error).not.toHaveBeenCalled();

                    done();
                });
            });
        });
    });

    describe('activity detection', () => {
        it('has an infinite time when unsubscribed, subscribing and unsubscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
            subscription.onSubscribe();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
            tick(50);
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
            setTimeout(() => {
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(100 * 1000);
                tick(10);
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(100 * 1000 - 10);

                subscription.onUnsubscribe();
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

                transport.deleteResolve({ status: 200 });
                setTimeout(() => {
                    expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
                    subscription.onSubscribe();
                    expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

                    sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
                    setTimeout(() => {
                        expect(subscription.timeTillOrphaned(Date.now())).toEqual(100 * 1000);

                        done();
                    });
                });
            });
        });
        it('has an infinite time when there is no inactivity timeout', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 0, Snapshot: {} });
            setTimeout(() => {
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
                done();
            });
        });
        it('has an infinite time when the connection is unavailable', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            setTimeout(() => {
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);
                subscription.onConnectionUnavailable();
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
                done();
            });
        });

        it('counts data updates as an activity', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            setTimeout(() => {
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);
                tick(9000);

                expect(subscription.timeTillOrphaned(Date.now())).toEqual(1 * 1000);
                subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: [1, 3] });
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);

                tick(4956);
                subscription.onStreamingData({ ReferenceId: subscription.referenceId, Data: [1, 3] });
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);

                done();
            });
        });
        it('counts heartbeats as an activity', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            setTimeout(() => {
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);
                tick(9000);

                expect(subscription.timeTillOrphaned(Date.now())).toEqual(1 * 1000);
                subscription.onHeartbeat();
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);

                tick(4956);
                subscription.onHeartbeat();
                expect(subscription.timeTillOrphaned(Date.now())).toEqual(10 * 1000);

                done();
            });
        });
    });

    describe('reset behaviour', () => {
        it('does nothing if unsubscribed or unsubscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.reset(); // reset before subscribed

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
            setTimeout(() => {

                subscription.onUnsubscribe();

                expect(transport.post.mock.calls.length).toEqual(1);
                transport.post.mockClear();
                expect(transport.delete.mock.calls.length).toEqual(1);
                transport.delete.mockClear();

                let oldReferenceId = subscription.referenceId;
                subscription.reset(); // reset when trying to unsubscribe
                expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

                expect(transport.post.mock.calls.length).toEqual(0);
                expect(transport.delete.mock.calls.length).toEqual(0);

                transport.deleteResolve({ status: 200 });
                setTimeout(() => {

                    oldReferenceId = subscription.referenceId;
                    subscription.reset(); // reset when unsubscribed
                    expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

                    expect(transport.post.mock.calls.length).toEqual(0);
                    expect(transport.delete.mock.calls.length).toEqual(0);

                    done();
                });
            });
        });

        it('subscribes if in the process of subscribing', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);
            const resolveToInitialSubscribe = transport.postResolve;

            const oldReferenceId = subscription.referenceId;
            subscription.reset(); // reset before subscribe response
            expect(oldReferenceId).not.toEqual(subscription.referenceId);

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            resolveToInitialSubscribe({ status: 201, response: { Snapshot: { initial: true } } });

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });
            setTimeout(() => {

                expect(errorSpy.mock.calls.length).toEqual(0);

                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0]).toEqual([{ resetResponse: true }, subscription.UPDATE_TYPE_SNAPSHOT]);

                done();
            });
        });

        it('subscribes if in the process of subscribing and handles a reject on an old subscription request', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);
            const rejectToInitialSubscribe = transport.postReject;

            const oldReferenceId = subscription.referenceId;
            subscription.reset(); // reset before subscribe response
            expect(oldReferenceId).not.toEqual(subscription.referenceId);

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            rejectToInitialSubscribe({ status: 401 });

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });
            setTimeout(() => {

                expect(errorSpy.mock.calls.length).toEqual(0);

                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0]).toEqual([{ resetResponse: true }, subscription.UPDATE_TYPE_SNAPSHOT]);

                done();
            });
        });

        it('subscribes if currently subscribed', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                // normally subscribed

                const oldReferenceId = subscription.referenceId;
                subscription.reset();

                // sends delete request for old subscription
                expect(transport.delete.mock.calls.length).toEqual(1);
                expect(transport.delete.mock.calls[0][2].referenceId).toEqual(oldReferenceId);

                expect(oldReferenceId).not.toEqual(subscription.referenceId);

                // sent off another new request for a subscription
                expect(transport.post.mock.calls.length).toEqual(1);
                transport.post.mockClear();

                done();
            });
        });
    });

    describe('protobuf parsing', () => {

        it('should parse schema from snapshot and pass JSON data', (done) => {
            const args = {
                Format: 'application/x-protobuf',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', args, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Schema: mockProtoPrice.schema,
                SchemaName: 'Price',
                Snapshot: mockProtoPrice.objectMessage,
            });

            setTimeout(() => {
                expect(transport.post.mock.calls.length).toEqual(1);
                expect(
                    updateSpy.mock.calls[0][0]
                ).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage)
                );

                const parser = subscription.parser;

                const schemaObject = parser.getSchemaType('Price', 'PriceResponse');
                expect(schemaObject).toBeTruthy();

                const plainFields = JSON.parse(JSON.stringify(schemaObject.fields));
                expect(plainFields).toEqual(expect.objectContaining(mockProtoPrice.fields));

                done();
            });
        });

        it('should parse streaming update', (done) => {
            const args = {
                Format: 'application/x-protobuf',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', args, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Schema: mockProtoPrice.schema,
                SchemaName: 'PriceResponse',
                Snapshot: mockProtoPrice.objectMessage,
            });

            setTimeout(() => {
                expect(transport.post.mock.calls.length).toEqual(1);

                const streamingData = {
                    ReferenceId: subscription.referenceId,
                    Data: mockProtoPrice.encodedMessage,
                    SchemaName: 'PriceResponse',
                };

                subscription.onStreamingData(streamingData);

                const [lastMessageArgument, lastTypeArgument] =
                    updateSpy.mock.calls[updateSpy.mock.calls.length - 1];

                expect(lastTypeArgument).toEqual(subscription.UPDATE_TYPE_DELTA);
                expect(
                    JSON.parse(JSON.stringify(lastMessageArgument.Data))
                ).toEqual(
                    expect.objectContaining(mockProtoPrice.decodedObjectMessage)
                );

                done();
            });
        });
    });

    describe('json parsing', () => {

        it('should parse data without schema', (done) => {
            const args = {
                Format: 'application/json',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', args, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            setTimeout(() => {
                expect(transport.post.mock.calls.length).toEqual(1);
                expect(
                    updateSpy.mock.calls[0][0]
                ).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage)
                );
                done();
            });
        });

        it('should default to json if format is not provided', (done) => {
            const args = {
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', args, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            setTimeout(() => {
                expect(transport.post.mock.calls.length).toEqual(1);
                expect(
                    updateSpy.mock.calls[0][0]
                ).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage)
                );
                done();
            });
        });

        it('should parse streaming update', (done) => {
            const args = {
                Format: 'application/json',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', args, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            setTimeout(() => {
                expect(transport.post.mock.calls.length).toEqual(1);

                const streamingData = {
                    ReferenceId: subscription.referenceId,
                    Data: mockProtoPrice.objectMessage,
                };

                subscription.onStreamingData(streamingData);

                const [lastMessageArgument, lastTypeArgument] =
                    updateSpy.mock.calls[updateSpy.mock.calls.length - 1];

                expect(lastTypeArgument).toEqual(subscription.UPDATE_TYPE_DELTA);
                expect(lastMessageArgument.Data).toEqual(expect.objectContaining(mockProtoPrice.objectMessage));

                done();
            });
        });
    });

    describe('modify behaviour', () => {

        it('calls patch on modify with patch method option', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                const newArgs = {
                    newArgs: 'newArgs',
                    testArgs: 'test',
                };
                const patchArgsDelta = { testArgs: 'argsDelta' };
                subscription.onModify(newArgs, { isPatch: true, patchArgsDelta });
                // new arguments assigned to the subscription
                expect(subscription.subscriptionData.Arguments).toEqual({
                    newArgs: 'newArgs',
                    testArgs: 'test',
                });
                // sends patch request on modify
                expect(transport.patch.mock.calls.length).toEqual(1);

                done();
            });
        });

        it('resubscribes with new arguments on modify without patch method option', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                const newArgs = { newArgs: 'test' };
                subscription.onModify(newArgs);
                // subscribed with new arguments
                expect(subscription.subscriptionData.Arguments).toEqual(newArgs);
                // sends delete request on modify
                expect(transport.delete.mock.calls.length).toEqual(1);
                expect(transport.post.mock.calls.length).toEqual(1);

                done();
            });
        });

        it('sends next patch request only after previous patch completed', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                const args = { args: 'args' };
                const newArgs = { args: 'newArgs' };
                subscription.onModify(args, { isPatch: true, patchArgsDelta: { newArgs: 'firstArgs' } });
                subscription.onModify(newArgs, { isPatch: true, patchArgsDelta: { newArgs: 'secondArgs' } });

                expect(transport.patch.mock.calls.length).toEqual(1);
                // first patch arguments sent
                expect(transport.patch.mock.calls[0][3].body).toEqual({ newArgs: 'firstArgs' });

                transport.patchResolve({ status: '200', response: '' });

                setTimeout(() => {
                    expect(transport.patch.mock.calls.length).toEqual(2);
                    // second patch arguments sent
                    expect(transport.patch.mock.calls[1][3].body).toEqual({ newArgs: 'secondArgs' });
                    expect(subscription.subscriptionData.Arguments).toEqual(newArgs);
                    done();
                });
            });
        });

        it('does not set state back to STATE_SUBSCRIBED after reset', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                const stateBeforeModify = subscription.currentState;
                const patchArgsDelta = { argsDelta: 'argsDelta' };
                subscription.onModify({ newArgs: 'test' }, { isPatch: true, patchArgsDelta });
                subscription.reset();

                transport.patchResolve({ status: '200', response: '' });
                setTimeout(() => {
                    expect(subscription.currentState).not.toEqual(stateBeforeModify);
                    done();
                });
            });
        });

        it('does not set state back to STATE_SUBSCRIBED after reset on modify patch error', (done) => {
            const subscription = new Subscription('123', transport, 'serviceGroup', 'src/test/resource', {}, createdSpy, updateSpy);
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: { resetResponse: true } });

            setTimeout(() => {
                const stateBeforeModify = subscription.currentState;
                const patchArgsDelta = { argsDelta: 'argsDelta' };
                subscription.onModify({ newArgs: 'test' }, { isPatch: true, patchArgsDelta });
                subscription.reset();

                transport.patchReject({ status: '500', response: 'patch failed' });
                setTimeout(() => {
                    expect(subscription.currentState).not.toEqual(stateBeforeModify);
                    done();
                });
            });
        });
    });
});
