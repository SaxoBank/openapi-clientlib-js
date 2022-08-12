import protobuf from 'protobufjs';
import {
    setTimeout,
    installClock,
    uninstallClock,
    tick,
} from '../../test/utils';
import mockTransport from '../../test/mocks/transport';
import * as mockProtoPrice from '../../test/mocks/proto-price';
import log from '../../log';
import Subscription, { __forTestingOnlyResetReferenceId } from './subscription';
import ParserProtobuf from './parser/parser-protobuf';
import ParserFacade from './parser/parser-facade';
import * as subscriptionActions from './subscription-actions';

ParserFacade.addEngines({
    'application/x-protobuf': protobuf,
});

ParserFacade.addParsers({
    'application/x-protobuf': ParserProtobuf,
});

function wait() {
    return new Promise<void>((resolve) => {
        setTimeout(resolve);
    });
}

describe('openapi StreamingSubscription', () => {
    let transport: any;
    let updateSpy: jest.Mock;
    let readyToRemoveSpy: jest.Mock;
    let createdSpy: jest.Mock;
    let errorSpy: jest.Mock;
    let authManager: { getAuth: jest.Mock };
    let networkErrorSpy: jest.Mock;
    let logError: jest.SpyInstance;

    function sendInitialResponse(response?: Record<string, any>) {
        if (!response) {
            response = { Snapshot: { Data: [1, 'fish', 3] } };
        }
        transport.postResolve({ status: '200', response });
    }

    beforeEach(() => {
        installClock();
        ParserFacade.clearParsers();
        transport = mockTransport();
        updateSpy = jest.fn().mockName('update');
        readyToRemoveSpy = jest.fn().mockName('readyToRemove');
        createdSpy = jest.fn().mockName('create');
        errorSpy = jest.fn().mockName('error');
        networkErrorSpy = jest.fn().mockName('networkEror');
        authManager = { getAuth: jest.fn() };
        authManager.getAuth.mockImplementation(function () {
            return { token: 'TOKEN' };
        });
        __forTestingOnlyResetReferenceId();
        logError = jest.spyOn(log, 'error');
    });
    afterEach(function () {
        expect(logError.mock.calls.length).toEqual(0);
        uninstallClock();
    });

    describe('unsubscribe by tag behaviour', () => {
        let subscription: Subscription;

        beforeEach(() => {
            subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                { RefreshRate: 120 },
            );
        });

        it('is ready for unsubscribe immediately if not yet subscribed', () => {
            subscription.onUnsubscribeByTagPending();
            expect(subscription.isReadyForUnsubscribeByTag()).toBe(true);
        });

        it('is ready for unsubscribe ready immediately if no actions pending', async () => {
            subscription.onSubscribe();
            transport.postResolve();
            await wait();
            subscription.onUnsubscribeByTagPending();
            expect(subscription.isReadyForUnsubscribeByTag()).toBe(true);
        });

        it('is not ready for unsubscribe if subscription is pending', async () => {
            subscription.onSubscribe();
            await wait();
            subscription.onUnsubscribeByTagPending();
            expect(subscription.isReadyForUnsubscribeByTag()).toBe(false);
        });
    });

    describe('options', () => {
        it('accepts a refresh rate', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                { RefreshRate: 120 },
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource',
                null,
                expect.objectContaining({
                    body: expect.objectContaining({ RefreshRate: 120 }),
                }),
            ]);
        });
        it('has a minimum refresh rate', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                { RefreshRate: 1 },
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource',
                null,
                expect.objectContaining({
                    body: expect.objectContaining({ RefreshRate: 100 }),
                }),
            ]);
        });

        it('accepts a top', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                { RefreshRate: 120, Top: 10 },
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource?$top=10',
                null,
                expect.objectContaining({
                    body: expect.objectContaining({ RefreshRate: 120 }),
                }),
            ]);
        });

        it('accepts a header as part of the options argument', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { headers: { Header: 'header' } },
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource',
                null,
                expect.objectContaining({ headers: { Header: 'header' } }),
            ]);
        });

        it('will omit headers if none are passed', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource',
                null,
                expect.not.objectContaining({ headers: expect.anything() }),
            ]);
        });

        it('does not carry over headers mutation', async () => {
            const headers: Record<string, string> = { Header: 'header' };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { headers },
            );

            // Mutating passed headers and making sure results doesn't store newly added property.
            headers.Authorization = '1234123';

            subscription.onSubscribe();

            // Mutating passed headers and making sure results doesn't store newly added property.
            headers.MuatedValue = 'true';

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            subscription.onUnsubscribe();
            transport.deleteResolve({ status: '200', response: {} });

            await wait();
            subscription.onSubscribe();
            sendInitialResponse(initialResponse);

            expect(transport.post.mock.calls.length).toEqual(2);
            expect(transport.post.mock.calls[0]).toEqual([
                'servicePath',
                'src/test/resource',
                null,
                expect.objectContaining({
                    headers: { Header: 'header' },
                }),
            ]);
        });
    });

    describe('initial snapshot', () => {
        it('handles snapshots containing an array of data ', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            // the update function should be called once with all data
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                { Data: [1, 'fish', 3] },
                subscription.UPDATE_TYPE_SNAPSHOT,
                subscription,
            ]);
        });

        it('handles snapshots containing a single datum', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            const initialResponse = { Snapshot: 'wibble' };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                'wibble',
                subscription.UPDATE_TYPE_SNAPSHOT,
                subscription,
            ]);
        });

        it('handles errors', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onError: errorSpy },
            );
            subscription.onSubscribe();

            transport.postReject({
                status: '401',
                response: { message: 'An error has occurred' },
            });

            await wait();
            expect(errorSpy.mock.calls.length).toEqual(1);
            expect(errorSpy.mock.calls[0]).toEqual([
                {
                    status: '401',
                    response: { message: 'An error has occurred' },
                },
                subscription,
            ]);
            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBED,
            );
        });

        it('subscribe error when a modify is queued', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onError: errorSpy },
            );
            subscription.onSubscribe();

            const patchArgsDelta = { argsDelta: 'delta' };
            subscription.onModify(
                { args: 'test' },
                { isPatch: true, isReplace: false, patchArgsDelta },
            );

            expect(subscription.queue.items.length).toEqual(1);

            transport.postReject({
                status: '401',
                response: { message: 'An error has occurred' },
            });

            await wait();
            expect(errorSpy.mock.calls.length).toEqual(0);

            expect(subscription.queue.items.length).toEqual(0);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
        });

        it('subscribe error when a modify-replace is queued', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onError: errorSpy },
            );
            subscription.onSubscribe();

            subscription.onModify({ args: 'test' }, { isReplace: true });

            expect(subscription.queue.items.length).toEqual(1);

            transport.postReject({
                status: '401',
                response: { message: 'An error has occurred' },
            });

            await wait();
            expect(errorSpy.mock.calls.length).toEqual(0);

            expect(subscription.queue.items.length).toEqual(0);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
        });

        it('handles protobuf format errors fallback to json', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'test/resource',
                { Format: 'application/x-protobuf' },
                { onError: errorSpy },
            );
            subscription.onSubscribe();

            transport.postReject({
                status: '404',
                response: { ErrorCode: 'UnsupportedSubscriptionFormat' },
            });

            transport.post.mockClear();

            await wait();
            expect(errorSpy.mock.calls.length).toEqual(0);
            expect(subscription.subscriptionData.Format).toEqual(
                'application/json',
            );

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls[0][3].body.Format).toEqual(
                'application/json',
            );
        });

        it('catches exceptions thrown during initial update', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            updateSpy.mockImplementation(() => {
                throw new Error('Unhandled Exception');
            });

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(1);

            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: [1, 3],
            };
            subscription.onStreamingData(streamingData);

            // check we have not artificially set the streaming state as unsubscribed
            expect(updateSpy.mock.calls.length).toEqual(2);

            expect(logError.mock.calls.map((args) => args.slice(0, 2)))
                .toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Exception occurred in streaming snapshot update callback",
                  ],
                  Array [
                    "Subscription",
                    "Exception occurred in streaming delta update callback",
                  ],
                ]
            `);
            logError.mockClear();
        });
    });

    describe('streamed update', () => {
        let subscription: Subscription;
        beforeEach(async () => {
            subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();
            sendInitialResponse({ Snapshot: { Data: [] } });
            await wait();
            updateSpy.mockClear();
        });

        it('handles updates with the correct referenceId', () => {
            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: [1, 3],
            };
            subscription.onStreamingData(streamingData);

            // the update function should be called once
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                streamingData,
                subscription.UPDATE_TYPE_DELTA,
                subscription,
            ]);
        });

        it('handles single-valued updates', () => {
            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: ['foo'],
            };
            subscription.onStreamingData(streamingData);

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                streamingData,
                subscription.UPDATE_TYPE_DELTA,
                subscription,
            ]);
        });

        it('handles single-valued updates in modify patch state', () => {
            const patchArgsDelta = { argsDelta: 'delta' };
            subscription.onModify(
                { args: 'test' },
                { isPatch: true, isReplace: false, patchArgsDelta },
            );

            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: ['foo'],
            };
            subscription.onStreamingData(streamingData);

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                streamingData,
                subscription.UPDATE_TYPE_DELTA,
                subscription,
            ]);
        });

        it('catches exceptions thrown during updates', () => {
            updateSpy.mockImplementation(() => {
                throw new Error('Unhandled Exception');
            });

            expect(() =>
                subscription.onStreamingData({
                    ReferenceId: subscription.referenceId as string,
                    Data: 'foo',
                }),
            ).not.toThrowError();
            expect(logError.mock.calls.map((args) => args.slice(0, 2)))
                .toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Exception occurred in streaming delta update callback",
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('handles an unsubscribe from streaming data callback', () => {
            updateSpy.mockImplementation(() => subscription.onUnsubscribe());

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });
            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });

            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls.length).toEqual(1);
        });
    });

    describe('out of order behaviour', () => {
        it('handles getting a delta before an initial response', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            const streamingDelta = {
                ReferenceId: subscription.referenceId as string,
                Data: ['foo'],
            };
            subscription.onStreamingData(streamingDelta);

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(2);
            expect(updateSpy.mock.calls[0]).toEqual([
                initialResponse.Snapshot,
                subscription.UPDATE_TYPE_SNAPSHOT,
                subscription,
            ]);
            expect(updateSpy.mock.calls[1]).toEqual([
                streamingDelta,
                subscription.UPDATE_TYPE_DELTA,
                subscription,
            ]);
        });

        it('ignores updates when unsubscribed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });
            expect(updateSpy.mock.calls.length).toEqual(0);

            subscription.onSubscribe();

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(1);

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });

            expect(updateSpy.mock.calls.length).toEqual(2);

            subscription.onUnsubscribe();

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });

            expect(updateSpy.mock.calls.length).toEqual(2);
        });

        it('ignores snapshot when unsubscribed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();
            subscription.onUnsubscribe();

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });
            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(0);
        });

        it('ignores snapshot when unsubscribed if also disposed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();
            subscription.onUnsubscribe();
            subscription.dispose();

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });
            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();
            expect(updateSpy.mock.calls.length).toEqual(0);
        });

        it('ignores snapshot when going to unsubscribe after modify_replace', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            subscription.onModify(
                { test: true },
                {
                    isReplace: true,
                    isPatch: false,
                },
            );

            subscription.onUnsubscribe();
            subscription.onUnsubscribe(true);
            subscription.onRemove();

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: 'foo',
            });

            const initialResponse = { Snapshot: { Data: [1, 'fish', 3] } };
            sendInitialResponse(initialResponse);

            await wait();

            expect(updateSpy.mock.calls.length).toEqual(0);
        });

        it('throws an error if you subscribe when disposed', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();
            subscription.onUnsubscribe();
            subscription.dispose();

            expect(() => subscription.onSubscribe()).toThrow();
        });

        it('handles performAction with no action', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            // @ts-ignore
            subscription.performAction(null);
        });

        it('logs errors for out of state actions - remove if subscribed', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_REMOVE,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction Remove",
                    Object {
                      "action": 64,
                      "connectionAvailable": true,
                      "logDiagnostics": Array [
                        Object {
                          "queue": Array [],
                          "queuedAction": Object {
                            "action": 64,
                          },
                          "type": "perform",
                        },
                      ],
                      "servicePath": "servicePath",
                      "state": 2,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('logs errors for out of state actions - subscribe if transitioning', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBE_REQUESTED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_SUBSCRIBE,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction Subscribe",
                    Object {
                      "action": 1,
                      "servicePath": "servicePath",
                      "state": 1,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('logs errors for out of state actions - patch if transitioning', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBE_REQUESTED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_MODIFY_PATCH,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction Patch",
                    Object {
                      "action": 8,
                      "logDiagnostics": Array [
                        Object {
                          "queue": Array [],
                          "queuedAction": Object {
                            "action": 8,
                          },
                          "type": "perform",
                        },
                      ],
                      "servicePath": "servicePath",
                      "state": 1,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('logs errors for out of state actions - replace if transitioning', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBE_REQUESTED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_MODIFY_REPLACE,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction Replace",
                    Object {
                      "action": 16,
                      "logDiagnostics": Array [
                        Object {
                          "queue": Array [],
                          "queuedAction": Object {
                            "action": 16,
                          },
                          "type": "perform",
                        },
                      ],
                      "servicePath": "servicePath",
                      "state": 1,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('logs errors for out of state actions - unsubscribe if transitioning', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBE_REQUESTED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_UNSUBSCRIBE,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction Unsubscribe",
                    Object {
                      "action": 2,
                      "servicePath": "servicePath",
                      "state": 1,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });

        it('logs errors for out of state actions - unsubscribe by tag if transitioning', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            // this shouldn't happen, but adding to cover the code
            subscription.currentState = subscription.STATE_SUBSCRIBE_REQUESTED;
            // @ts-ignore
            subscription.performAction({
                action: subscriptionActions.ACTION_UNSUBSCRIBE_BY_TAG_PENDING,
            });

            expect(logError.mock.calls).toMatchInlineSnapshot(`
                Array [
                  Array [
                    "Subscription",
                    "Unanticipated state in performAction UnsubscribeByTagPending",
                    Object {
                      "action": 32,
                      "servicePath": "servicePath",
                      "state": 1,
                      "url": "src/test/resource",
                    },
                  ],
                ]
            `);
            logError.mockClear();
        });
    });

    describe('connection unavailable behaviour', () => {
        it('does not subscribe when the connection is unavailable', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onConnectionUnavailable();
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(0);
        });

        it('does not unsubscribe when the connection is unavailable', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);

            sendInitialResponse();

            await wait();
            // now subscribed.

            subscription.onConnectionUnavailable();
            subscription.onUnsubscribe();

            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onConnectionAvailable();
            expect(transport.delete.mock.calls.length).toEqual(1);
        });

        it('does not unsubscribe if connection becomes unavailable whilst subscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();
            subscription.onConnectionUnavailable();
            subscription.onUnsubscribe();

            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse();

            await wait();
            // now subscribed.
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onConnectionAvailable();

            expect(transport.delete.mock.calls.length).toEqual(1);
        });

        it('does not subscribe if connection becomes unavailable whilst unsubscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();

            sendInitialResponse();

            await wait();
            // now subscribed.

            subscription.onUnsubscribe();
            expect(transport.delete.mock.calls.length).toEqual(1);

            subscription.onConnectionUnavailable();
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(0);

            transport.deleteResolve({ status: 200 });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(0);

            subscription.onConnectionAvailable();

            expect(transport.post.mock.calls.length).toEqual(1);
        });

        it('does not subscribe if connection becomes available whilst unsubscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();

            sendInitialResponse();

            await wait();
            // now subscribed.

            subscription.onUnsubscribe();
            expect(transport.delete.mock.calls.length).toEqual(1);

            subscription.onConnectionUnavailable();
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(0);

            subscription.onConnectionAvailable();
            expect(transport.post.mock.calls.length).toEqual(0);

            transport.deleteResolve({ status: 200 });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);
        });

        it('retries when a network error occurs subscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(networkErrorSpy).toBeCalledTimes(1);

            tick(5000);
            expect(transport.post.mock.calls.length).toEqual(2);

            transport.postResolve({
                status: 201,
                response: { Snapshot: { initial: true } },
            });

            await wait();
            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).toBeCalledTimes(1);
            expect(networkErrorSpy).toBeCalledTimes(1);
        });

        it('does not retry when a network error occurs subscribing but we have unsubscribed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            subscription.onUnsubscribe();
            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            tick(5000);
            expect(transport.post.mock.calls.length).toEqual(1);

            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).not.toBeCalled();
            expect(networkErrorSpy).not.toBeCalled();
        });

        it('does not retry when a network error occurs subscribing but we afterwards unsubscribe', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            subscription.onUnsubscribe();
            tick(5000);
            expect(transport.post.mock.calls.length).toEqual(1);

            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).not.toBeCalled();
            expect(networkErrorSpy).toBeCalledTimes(1);
        });

        it('does not retry when a network error occurs subscribing but we afterwards modify', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            subscription.onModify();
            tick(5000);
            await wait();
            expect(transport.post.mock.calls.length).toEqual(2);

            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).not.toBeCalled();
            expect(networkErrorSpy).toBeCalledTimes(1);
        });

        it('does not retry when a network error occurs subscribing but we afterwards modify replace', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            subscription.onModify(
                { test: true },
                {
                    isReplace: true,
                },
            );
            tick(5000);
            await wait();
            expect(transport.post.mock.calls.length).toEqual(2);

            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).not.toBeCalled();
            expect(networkErrorSpy).toBeCalledTimes(1);
        });

        it('does not retry when a network error occurs subscribing but we afterwards modify patch', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            subscription.onModify(
                { test: true },
                {
                    isReplace: false,
                    isPatch: true,
                    patchArgsDelta: { test: true },
                },
            );
            tick(5000);
            await wait();
            expect(transport.post.mock.calls.length).toEqual(2);

            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).not.toBeCalled();
            expect(networkErrorSpy).toBeCalledTimes(1);
        });

        it('waits for a network reconnect if it gets told that it is unavailable', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onError: errorSpy,
                    onNetworkError: networkErrorSpy,
                },
            );
            subscription.onSubscribe();
            expect(transport.post.mock.calls.length).toEqual(1);

            transport.postReject({ isNetworkError: true });

            await wait();
            expect(networkErrorSpy).toBeCalledTimes(1);
            expect(transport.post.mock.calls.length).toEqual(1);

            tick(1000);

            subscription.onConnectionUnavailable();

            tick(100000);

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            expect(updateSpy).not.toBeCalled();

            subscription.onConnectionAvailable();

            expect(transport.post.mock.calls.length).toEqual(2);
            transport.postResolve({
                status: 201,
                response: { Snapshot: { initial: true } },
            });

            await wait();
            expect(errorSpy).not.toBeCalled();
            expect(updateSpy).toBeCalledTimes(1);
            expect(networkErrorSpy).toBeCalledTimes(1);
        });
    });

    describe('remove', () => {
        it('should call onSubscriptionReadyToRemove', (done) => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onSubscriptionCreated: createdSpy,
                    onSubscriptionReadyToRemove: readyToRemoveSpy,
                },
            );

            subscription.onRemove();

            setTimeout(() => {
                // it does invoke onSubscriptionReadyToRemove callback
                expect(readyToRemoveSpy.mock.calls.length).toEqual(1);
                // it does invoke onSubscriptionReadyToRemove callback with reference to subscription
                expect(readyToRemoveSpy.mock.calls[0][0]).toEqual(subscription);
                done();
            });
        });
    });

    describe('subscribe/unsubscribe queuing', () => {
        it('ignores multiple commands when already in the right state', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

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
            await wait();
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
            await wait();
            // now unsubscribed

            subscription.onUnsubscribe();
            subscription.onUnsubscribe();
            subscription.onUnsubscribe();
            subscription.onUnsubscribe();

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);
        });

        it('accept unsubscribe followed by a subscribe when waiting for an action to respond', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();
            transport.post.mockClear();
            // waiting for subscribe to respond

            subscription.onUnsubscribe();
            subscription.onSubscribe();

            sendInitialResponse();
            await wait();
            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);
        });

        it('if an error occurs unsubscribing then it continues with the next action', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse();
            await wait();
            subscription.onUnsubscribe();
            subscription.onSubscribe();

            transport.deleteReject();
            transport.post.mockClear();

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1); // it does the subscribe after the unsubscribe fails
        });

        it('ignores a subscribe followed by an unsubscribe when waiting for an action to respond', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            jest.spyOn(log, 'error');

            subscription.onSubscribe();
            transport.post.mockClear();

            sendInitialResponse();

            await wait();
            subscription.onUnsubscribe();
            transport.delete.mockClear();
            // waiting for unsubscribe to occur

            subscription.onSubscribe();
            subscription.onUnsubscribe();

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            transport.deleteResolve({ status: 200 });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            expect(log.error).not.toHaveBeenCalled();
        });

        it('should not fire deltas if force unsubscribe has been called', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onUpdate: updateSpy,
                    onSubscriptionCreated: createdSpy,
                    onSubscriptionReadyToRemove: readyToRemoveSpy,
                },
            );

            subscription.onSubscribe();
            transport.post.mockClear();

            sendInitialResponse();

            await wait();
            updateSpy.mockClear();
            subscription.onConnectionUnavailable();
            subscription.onUnsubscribe(true);
            subscription.onRemove();

            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: [1, 3],
            });
            expect(updateSpy).not.toBeCalled();
            expect(transport.delete.mock.calls.length).toEqual(0);
            subscription.onConnectionAvailable();
            await wait();
            expect(updateSpy).not.toBeCalled();
            expect(transport.delete.mock.calls.length).toEqual(1);
        });
    });

    describe('activity detection', () => {
        it('has an infinite time when unsubscribed, subscribing and unsubscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
            subscription.onSubscribe();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
            tick(50);
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                100 * 1000,
            );
            tick(10);
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                100 * 1000 - 10,
            );

            subscription.onUnsubscribe();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

            transport.deleteResolve({ status: 200 });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
            subscription.onSubscribe();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: {},
            });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                100 * 1000,
            );
        });
        it('has an infinite time when there is no inactivity timeout', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 0, Snapshot: {} });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
        });
        it('has an infinite time when the connection is unavailable', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );
            subscription.onConnectionUnavailable();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(Infinity);
        });

        it('counts data updates as an activity', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );
            tick(9000);

            expect(subscription.timeTillOrphaned(Date.now())).toEqual(1 * 1000);
            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: [1, 3],
            });
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );

            tick(4956);
            subscription.onStreamingData({
                ReferenceId: subscription.referenceId as string,
                Data: [1, 3],
            });
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );
        });
        it('counts heartbeats as an activity', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 10, Snapshot: {} });
            await wait();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );
            tick(9000);

            expect(subscription.timeTillOrphaned(Date.now())).toEqual(1 * 1000);
            subscription.onHeartbeat();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );

            tick(4956);
            subscription.onHeartbeat();
            expect(subscription.timeTillOrphaned(Date.now())).toEqual(
                10 * 1000,
            );
        });
    });

    describe('reset behaviour', () => {
        it('does nothing if unsubscribed or unsubscribing', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );

            subscription.reset(true); // reset before subscribed

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
            await wait();
            subscription.onUnsubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.delete.mockClear();

            let oldReferenceId = subscription.referenceId;
            subscription.reset(true); // reset when trying to unsubscribe
            expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            transport.deleteResolve({ status: 200 });
            await wait();
            oldReferenceId = subscription.referenceId;
            subscription.reset(true); // reset when unsubscribed
            expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);
            expect(errorSpy.mock.calls.length).toEqual(0);
        });

        it('does nothing if unsubscribed or unsubscribing when subscribing afterwards', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );

            subscription.reset(true); // reset before subscribed

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onSubscribe();

            sendInitialResponse({ InactivityTimeout: 100, Snapshot: {} });
            await wait();
            subscription.onUnsubscribe();
            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(1);
            transport.delete.mockClear();

            let oldReferenceId = subscription.referenceId;
            subscription.reset(true); // reset when trying to unsubscribe
            expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            transport.deleteResolve({ status: 200 });
            await wait();
            oldReferenceId = subscription.referenceId;
            expect(oldReferenceId).toEqual(subscription.referenceId); // don't need to change as not subscribing

            expect(transport.post.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls.length).toEqual(0);
        });

        it('does nothing if going to unsubscribe anyway', () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            subscription.onSubscribe();
            subscription.onUnsubscribe();
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue).toMatchInlineSnapshot(`
                SubscriptionQueue {
                  "items": Array [
                    Object {
                      "action": 2,
                      "args": Object {
                        "force": false,
                      },
                    },
                  ],
                }
            `);
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue).toMatchInlineSnapshot(`
                SubscriptionQueue {
                  "items": Array [
                    Object {
                      "action": 2,
                      "args": Object {
                        "force": true,
                      },
                    },
                  ],
                }
            `);
        });

        it('unsubscribes if in the process of subscribing and then subscribes', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            const oldReferenceId = subscription.referenceId;
            subscription.reset(true); // reset before subscribe response
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue).toMatchInlineSnapshot(`
                SubscriptionQueue {
                  "items": Array [
                    Object {
                      "action": 2,
                      "args": Object {
                        "force": true,
                      },
                    },
                    Object {
                      "action": 1,
                      "args": Object {
                        "replace": false,
                      },
                    },
                  ],
                }
            `);

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(errorSpy.mock.calls.length).toEqual(0);
            expect(updateSpy.mock.calls.length).toEqual(0);
            expect(transport.post.mock.calls.length).toEqual(0);
            transport.deleteResolve({ status: 200 });

            await wait();
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls.length).toEqual(0);
            expect(oldReferenceId).not.toEqual(subscription.referenceId);
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            expect(errorSpy.mock.calls.length).toEqual(0);
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                { resetResponse: true },
                subscription.UPDATE_TYPE_SNAPSHOT,
                subscription,
            ]);
        });

        it('subscribes if in the process of subscribing and handles a reject on an old subscription request', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            const oldReferenceId = subscription.referenceId;
            subscription.reset(true); // reset before subscribe response
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue).toMatchInlineSnapshot(`
                SubscriptionQueue {
                  "items": Array [
                    Object {
                      "action": 2,
                      "args": Object {
                        "force": true,
                      },
                    },
                    Object {
                      "action": 1,
                      "args": Object {
                        "replace": false,
                      },
                    },
                  ],
                }
            `);

            expect(transport.post.mock.calls.length).toEqual(0);
            expect(transport.delete.mock.calls.length).toEqual(0);

            transport.postReject({ status: '404' });
            await wait();
            expect(transport.delete.mock.calls.length).toEqual(0);
            expect(updateSpy.mock.calls.length).toEqual(0);
            expect(errorSpy.mock.calls.length).toEqual(0);
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls.length).toEqual(0);
            expect(oldReferenceId).not.toEqual(subscription.referenceId);
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            expect(errorSpy.mock.calls.length).toEqual(0);
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0]).toEqual([
                { resetResponse: true },
                subscription.UPDATE_TYPE_SNAPSHOT,
                subscription,
            ]);
        });

        it('re-subscribes if currently subscribed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            // normally subscribed

            const oldReferenceId = subscription.referenceId;
            subscription.reset(true);

            // sends delete request for old subscription
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls[0][2].referenceId).toEqual(
                oldReferenceId,
            );
            expect(transport.post.mock.calls.length).toEqual(0);
            transport.deleteResolve({ status: 200 });
            await wait();
            expect(oldReferenceId).not.toEqual(subscription.referenceId);
            // now sent off a new subscribe request
            expect(transport.post.mock.calls.length).toEqual(1);
        });

        it('re-subscribes if currently subscribed and unsubscribe fails', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            expect(transport.post.mock.calls.length).toEqual(1);
            transport.post.mockClear();
            expect(transport.delete.mock.calls.length).toEqual(0);

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            // normally subscribed

            const oldReferenceId = subscription.referenceId;
            subscription.reset(true);

            // sends delete request for old subscription
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.delete.mock.calls[0][2].referenceId).toEqual(
                oldReferenceId,
            );
            expect(transport.post.mock.calls.length).toEqual(0);
            transport.deleteReject({ status: 404 });
            await wait();
            expect(oldReferenceId).not.toEqual(subscription.referenceId);
            // now sent off a new subscribe request
            expect(transport.post.mock.calls.length).toEqual(1);
        });

        describe('3 resets within 1 minute', () => {
            it('should handle 3 resets and then nothing else', async () => {
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    {},
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );

                subscription.onSubscribe();

                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: { resetResponse: true },
                });

                await wait();

                // subscribed

                subscription.reset(true);
                subscription.reset(true);
                subscription.reset(true);

                expect(
                    subscription.waitForPublisherToRespondTimer,
                ).toBeTruthy();
                expect(
                    subscription.publisherDownReferenceId,
                ).toMatchInlineSnapshot(`"1"`);
                expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

                expect(subscription.currentState).toEqual(
                    subscription.STATE_UNSUBSCRIBE_REQUESTED,
                );
                transport.deleteResolve({ status: 200 });
                await wait();
                expect(subscription.currentState).toEqual(
                    subscription.STATE_SUBSCRIBE_REQUESTED,
                );
                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: { resetResponse: true },
                });
                await wait();
                expect(subscription.currentState).toEqual(
                    subscription.STATE_SUBSCRIBED,
                );
                expect(
                    subscription.waitForPublisherToRespondTimer,
                ).toBeTruthy();
                expect(
                    subscription.publisherDownReferenceId,
                ).toMatchInlineSnapshot(`"1"`);

                // should reset after 1 minute
                tick(60000);

                expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
                expect(subscription.currentState).toEqual(
                    subscription.STATE_SUBSCRIBED,
                );
                expect(subscription.queue.items).toMatchInlineSnapshot(
                    `Array []`,
                );
            });

            it('should handle constant resets', async () => {
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    {},
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );

                subscription.onSubscribe();

                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: { resetResponse: true },
                });

                await wait();

                // subscribed

                subscription.reset(true);
                subscription.reset(true);
                subscription.reset(true);

                expect(
                    subscription.waitForPublisherToRespondTimer,
                ).toBeTruthy();
                expect(
                    subscription.publisherDownReferenceId,
                ).toMatchInlineSnapshot(`"1"`);
                expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

                expect(subscription.currentState).toEqual(
                    subscription.STATE_UNSUBSCRIBE_REQUESTED,
                );
                transport.deleteResolve({ status: 200 });
                subscription.reset(true);
                await wait();
                subscription.reset(true);
                expect(subscription.currentState).toEqual(
                    subscription.STATE_SUBSCRIBE_REQUESTED,
                );
                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: { resetResponse: true },
                });
                await wait();
                subscription.reset(true);
                expect(subscription.currentState).toEqual(
                    subscription.STATE_SUBSCRIBED,
                );
                expect(
                    subscription.waitForPublisherToRespondTimer,
                ).toBeTruthy();
                expect(
                    subscription.publisherDownReferenceId,
                ).toMatchInlineSnapshot(`"2"`);

                // should reset after 1 minute
                tick(60000);

                expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
                expect(subscription.currentState).toEqual(
                    subscription.STATE_UNSUBSCRIBE_REQUESTED,
                );
                expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);
            });
        });

        it('should handle resets followed by a unsubscribe - whilst resetting', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);
            subscription.onUnsubscribe();

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBED,
            );

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`Array []`);
        });

        it('should handle resets followed by a unsubscribe - after resetting', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"2"`,
            );

            subscription.onUnsubscribe();

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`Array []`);
        });

        it('should handle resets followed by a unsubscribe and then a subscribe', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"2"`,
            );

            subscription.onUnsubscribe();
            transport.deleteResolve({ status: 200 });
            await wait();

            subscription.onSubscribe();
            await wait();

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`Array []`);
        });

        it('should handle resets followed by a subscribe replace', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"2"`,
            );

            subscription.onModify({}, { isReplace: true });

            await wait();

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_REPLACE_REQUESTED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`Array []`);
        });

        it('should handle resets followed by patches with a final reset', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();

            // reset occurs after subscribed so we need to reset
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"2"`,
            );

            subscription.onModify(
                {},
                { isReplace: false, isPatch: true, patchArgsDelta: {} },
            );

            await wait();

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                Array [
                  Object {
                    "action": 2,
                    "args": Object {
                      "force": true,
                    },
                  },
                  Object {
                    "action": 1,
                    "args": Object {
                      "replace": false,
                    },
                  },
                ]
            `);
        });

        it('should handle resets followed by patches without a final reset', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            subscription.reset(true);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"1"`,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "action": 1,
                        "args": Object {
                          "replace": false,
                        },
                      },
                    ]
                `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
            transport.deleteResolve({ status: 200 });
            subscription.reset(true);

            await wait();

            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });
            await wait();

            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.waitForPublisherToRespondTimer).toBeTruthy();
            expect(subscription.publisherDownReferenceId).toMatchInlineSnapshot(
                `"2"`,
            );

            subscription.onModify(
                {},
                { isReplace: false, isPatch: true, patchArgsDelta: {} },
            );

            await wait();

            // should reset after 1 minute
            tick(60000);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                Array [
                  Object {
                    "action": 2,
                    "args": Object {
                      "force": true,
                    },
                  },
                  Object {
                    "action": 1,
                    "args": Object {
                      "replace": false,
                    },
                  },
                ]
            `);
        });

        it('should act normally if resets are far apart', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            // subscribed

            subscription.reset(true);
            tick(30000);
            subscription.reset(true);
            tick(30001);
            subscription.reset(true);

            expect(subscription.waitForPublisherToRespondTimer).toBeFalsy();
            expect(subscription.publisherDownReferenceId).toEqual(null);
            expect(subscription.queue.items).toMatchInlineSnapshot(`
                Array [
                  Object {
                    "action": 1,
                    "args": Object {
                      "replace": false,
                    },
                  },
                ]
            `);

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );
        });
    });

    describe('protobuf parsing', () => {
        it('should parse schema from snapshot and pass JSON data', async () => {
            const args = {
                Format: 'application/x-protobuf',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                args,
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Schema: mockProtoPrice.schema,
                SchemaName: 'Price',
                Snapshot: mockProtoPrice.objectMessage,
            });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0][0]).toEqual(
                expect.objectContaining(mockProtoPrice.objectMessage),
            );

            const parser = subscription.parser;

            const schemaObject: any = parser.getSchemaType(
                'Price',
                'PriceResponse',
            );
            expect(schemaObject).toBeTruthy();

            const plainFields = JSON.parse(JSON.stringify(schemaObject.fields));
            expect(plainFields).toEqual(
                expect.objectContaining(mockProtoPrice.fields),
            );
        });

        it('should parse streaming update', async () => {
            const args = {
                Format: 'application/x-protobuf',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                args,

                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Schema: mockProtoPrice.schema,
                SchemaName: 'PriceResponse',
                Snapshot: mockProtoPrice.objectMessage,
            });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: mockProtoPrice.encodedMessage,
                SchemaName: 'PriceResponse',
            };

            subscription.onStreamingData(streamingData);

            const [lastMessageArgument, lastTypeArgument] =
                updateSpy.mock.calls[updateSpy.mock.calls.length - 1];

            expect(lastTypeArgument).toEqual(subscription.UPDATE_TYPE_DELTA);
            expect(
                JSON.parse(JSON.stringify(lastMessageArgument.Data)),
            ).toEqual(
                expect.objectContaining(mockProtoPrice.decodedObjectMessage),
            );
        });

        describe('Service Upgrade Scenario', () => {
            it('should cope with not getting a SchemaName', async () => {
                const args = {
                    Format: 'application/x-protobuf',
                    Arguments: {
                        ClientKey: '1234',
                    },
                };
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    args,
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );
                subscription.onSubscribe();

                subscription.parser.addSchema(mockProtoPrice.schema, 'Price');

                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0][0]).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage),
                );

                const parser = subscription.parser;

                const schemaObject: any = parser.getSchemaType(
                    'Price',
                    'PriceResponse',
                );
                expect(schemaObject).toBeTruthy();

                const plainFields = JSON.parse(
                    JSON.stringify(schemaObject.fields),
                );
                expect(plainFields).toEqual(
                    expect.objectContaining(mockProtoPrice.fields),
                );
            });

            it('should cope with getting a SchemaName but no Schema', async () => {
                const args = {
                    Format: 'application/x-protobuf',
                    Arguments: {
                        ClientKey: '1234',
                    },
                };
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    args,
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );
                subscription.onSubscribe();

                subscription.parser.addSchema(mockProtoPrice.schema, 'Price');

                sendInitialResponse({
                    InactivityTimeout: 100,
                    SchemaName: 'Price',
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0][0]).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage),
                );

                const parser = subscription.parser;

                const schemaObject: any = parser.getSchemaType(
                    'Price',
                    'PriceResponse',
                );
                expect(schemaObject).toBeTruthy();

                const plainFields = JSON.parse(
                    JSON.stringify(schemaObject.fields),
                );
                expect(plainFields).toEqual(
                    expect.objectContaining(mockProtoPrice.fields),
                );
            });
        });

        describe('error scenario', () => {
            it('should fallback if there is an error subscribing', async () => {
                const args = {
                    Format: 'application/x-protobuf',
                    Arguments: {
                        ClientKey: '1234',
                    },
                };
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    args,
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );
                subscription.onSubscribe();

                sendInitialResponse({
                    InactivityTimeout: 100,
                    SchemaName: 'Price',
                    Schema: 'Invalid Schema!',
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(1);
                expect(transport.delete.mock.calls.length).toEqual(1);
                transport.deleteResolve({ status: '200', response: {} });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(2);
                expect(transport.post.mock.calls[1]).toEqual([
                    'servicePath',
                    'src/test/resource',
                    null,
                    {
                        body: {
                            Arguments: {
                                ClientKey: '1234',
                            },
                            ContextId: '123',
                            Format: 'application/json',
                            KnownSchemas: undefined,
                            ReferenceId: expect.any(String),
                            RefreshRate: 1000,
                            ReplaceReferenceId: undefined,
                        },
                    },
                ]);

                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls[0][0]).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage),
                );

                const streamingData = {
                    ReferenceId: subscription.referenceId as string,
                    Data: mockProtoPrice.objectMessage,
                };

                subscription.onStreamingData(streamingData);

                expect(updateSpy.mock.calls.length).toEqual(2);
                expect(updateSpy.mock.calls[1][0]).toEqual(
                    expect.objectContaining({
                        Data: mockProtoPrice.objectMessage,
                    }),
                );
                expect(updateSpy.mock.calls[1][1]).toEqual(
                    subscription.UPDATE_TYPE_DELTA,
                );
                expect(
                    subscription.parser.getFormatName(),
                ).toMatchInlineSnapshot(`"application/json"`);

                expect(logError.mock.calls).toMatchInlineSnapshot(`
                    Array [
                      Array [
                        "ParserProtobuf",
                        "Schema parsing failed",
                        Object {
                          "error": [Error: illegal token 'Invalid' (line 1)],
                          "name": "Price",
                          "schemaData": "Invalid Schema!",
                        },
                      ],
                      Array [
                        "Subscription",
                        "Fallback to json after failure to add schema",
                        Object {
                          "error": [Error: Protobuf schema parsing failed],
                        },
                      ],
                    ]
                `);
                logError.mockClear();
            });

            it('should fallback if there is an error parsing an update', async () => {
                const args = {
                    Format: 'application/x-protobuf',
                    Arguments: {
                        ClientKey: '1234',
                    },
                };
                const subscription = new Subscription(
                    '123',
                    transport,
                    'servicePath',
                    'src/test/resource',
                    args,
                    { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
                );
                subscription.onSubscribe();

                sendInitialResponse({
                    InactivityTimeout: 100,
                    SchemaName: 'Price',
                    Schema: mockProtoPrice.schema,
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(1);
                expect(updateSpy.mock.calls.length).toEqual(1);

                const streamingPBufBrokenData = {
                    ReferenceId: subscription.referenceId as string,
                    Data: 'rubbish' + mockProtoPrice.encodedMessage,
                };

                subscription.onStreamingData(streamingPBufBrokenData);

                expect(updateSpy.mock.calls.length).toEqual(1);
                expect(transport.delete.mock.calls.length).toEqual(1);
                transport.deleteResolve({ status: '200', response: {} });

                await wait();

                expect(transport.post.mock.calls.length).toEqual(2);
                expect(transport.post.mock.calls[1]).toEqual([
                    'servicePath',
                    'src/test/resource',
                    null,
                    {
                        body: {
                            Arguments: {
                                ClientKey: '1234',
                            },
                            ContextId: '123',
                            Format: 'application/json',
                            KnownSchemas: undefined,
                            ReferenceId: expect.any(String),
                            RefreshRate: 1000,
                            ReplaceReferenceId: undefined,
                        },
                    },
                ]);

                sendInitialResponse({
                    InactivityTimeout: 100,
                    Snapshot: mockProtoPrice.objectMessage,
                });

                await wait();

                expect(updateSpy.mock.calls.length).toEqual(2);
                expect(updateSpy.mock.calls[1][0]).toEqual(
                    expect.objectContaining(mockProtoPrice.objectMessage),
                );

                const streamingJSONData = {
                    ReferenceId: subscription.referenceId as string,
                    Data: mockProtoPrice.objectMessage,
                };

                subscription.onStreamingData(streamingJSONData);

                expect(updateSpy.mock.calls.length).toEqual(3);
                expect(updateSpy.mock.calls[2][0]).toEqual(
                    expect.objectContaining({
                        Data: mockProtoPrice.objectMessage,
                    }),
                );
                expect(updateSpy.mock.calls[2][1]).toEqual(
                    subscription.UPDATE_TYPE_DELTA,
                );
                expect(
                    subscription.parser.getFormatName(),
                ).toMatchInlineSnapshot(`"application/json"`);
                expect(logError.mock.calls).toMatchInlineSnapshot(`
                    Array [
                      Array [
                        "ParserProtobuf",
                        "Protobuf parsing failed",
                        Object {
                          "base64Data": "rubbishCghGeE9wdGlvbhI/CUw3iUFgpSRAEfgZFw6EpCZAGQAAAAAAQI9AIdeGinH+JlQ/KSUGgZVDi9Q/MXsUrkfhetQ/OSlcj8L1KLw/GkgJAAAAAAAA8D8RAAAAAACYn0AZAAAAAAAACEAhAAAAAABwn0ApAAAAAAAAFEAxAAAAAACMn0A5AAAAAAAAHEBBAAAAAAAAIEAi1QEJAAAAAAAA8D8RAAAAAAAAAEAZAAAAAAAACEAhAAAAAAAAEEApAAAAAAAAFEAwATgBQQAAAAAAACBASQAAAAAAACJAUgYI+NqL0AVYAWHcRgN4CyT1P2nrc7UV+8vxP3HPZtXnaiv1P3nWxW00gLfzP4IBBgj42ovQBYkBsHJoke18vz+RASUGgZVDi9Q/mQEYeO49XHK8P6ABAakBw/UoXI/C8T+xAR+F61G4HvU/ugEGCPjai9AFwQFrmnecoiP1P8kB+MJkqmBU9T/SAQYI+NqL0AUqBgj42ovQBTIkCR+F61G4HvU/EQrXo3A9CgFAGcP1KFyPwvE/IYlBYOXQIvU/OnIKEIlBYOXQIvU/w/UoXI/C8T8SEPYoXI/C9QhA4XoUrkfhCEAaEAAAAAAAQI9AAAAAAABAn0AiECPb+X5qvPY/iUFg5dAi9T8qELx0kxgEVvg/nu+nxks39z8yEAAAAAAAQJ9AAAAAAADAkkA4IEBISAFCJAmuR+F6FK7zPxHsUbgehevxPxkAAAAAAAAmQCG4HoXrUbi+P0oGTkFTREFRUksIzgkRrkfhehSu8z8Zw/UoXI/C8T8gFyoEMTIzNTFmZmZmZmbyPzoHYXNrdHlwZUIHYmlkdHlwZUoLMTIzMTNjZGFkYWRSBGlkbGVYrGA=",
                          "error": [Error: invalid wire type 6 at offset 10],
                          "schema": "syntax = \\"proto3\\"; 
                    import \\"google/protobuf/timestamp.proto\\"; 

                    option saxobank_root = \\"PriceResponse\\";

                    message PriceResponse {
                       message Greeks {
                          double delta = 1;
                          double gamma = 2;
                          double mid_vol = 3;
                          double phi = 4;
                          double rho = 5;
                          double theta = 6;
                          double vega = 7;
                       }

                       message HistoricalChanges {
                          double percent_change1_month = 1;
                          double percent_change1_year = 2;
                          double percent_change2_months = 3;
                          double percent_change2_years = 4;
                          double percent_change3_months = 5;
                          double percent_change5_years = 6;
                          double percent_change6_months = 7;
                          double percent_change_weekly = 8;
                       }

                       message InstrumentPriceDetails {
                          double accrued_interest = 1;
                          double ask_swap = 2;
                          double bid_swap = 3;
                          double cfd_borrowing_cost = 4;
                          double cfd_hard_to_finance_rate = 5;
                          bool cfd_price_adjustment = 6;
                          bool dma = 7;
                          double est_price_buy = 8;
                          double est_price_sell = 9;
                          google.protobuf.Timestamp expiry_date = 10;
                          bool is_market_open = 11;
                          double lower_barrier = 12;
                          double mid_forward_price = 13;
                          double mid_spot_price = 14;
                          double mid_yield = 15;
                          google.protobuf.Timestamp notice_date = 16;
                          double open_interest = 17;
                          double paid_cfd_interest = 18;
                          double received_cfd_interest = 19;
                          bool short_trade_disabled = 20;
                          double spot_ask = 21;
                          double spot_bid = 22;
                          google.protobuf.Timestamp spot_date = 23;
                          double strike_price = 24;
                          double upper_barrier = 25;
                          google.protobuf.Timestamp value_date = 26;
                       }

                       message MarginImpact {
                          double impact_buy = 1;
                          double impact_sell = 2;
                          double initial_margin = 3;
                          double maintenance_margin = 4;
                       }

                       message MarketDepth {
                          repeated double ask = 1;
                          repeated double ask_orders = 2;
                          repeated double ask_size = 3;
                          repeated double bid = 4;
                          repeated double bid_orders = 5;
                          repeated double bid_size = 6;
                          int32 no_of_bids = 7;
                          int32 no_of_offers = 8;
                          bool using_orders = 9;
                       }

                       message PriceInfo {
                          double high = 1;
                          double low = 2;
                          double net_change = 3;
                          double percent_change = 4;
                       }

                       message TradableQuote {
                          int32 amount = 1;
                          double ask = 2;
                          double bid = 3;
                          int32 delayed_by_minutes = 4;
                          string error_code = 5;
                          double mid = 6;
                          string price_type_ask = 7;
                          string price_type_bid = 8;
                          string quote_id = 9;
                          string r_f_q_state = 10;
                       }

                       string asset_type = 1;
                       Greeks greeks = 2;
                       HistoricalChanges historical_changes = 3;
                       InstrumentPriceDetails instrument_price_details = 4;
                       google.protobuf.Timestamp last_updated = 5;
                       MarginImpact margin_impact = 6;
                       MarketDepth market_depth = 7;
                       PriceInfo price_info = 8;
                       string price_source = 9;
                       TradableQuote quote = 10;
                       int32 uic = 11;
                    }",
                          "schemaName": "Price",
                        },
                      ],
                      Array [
                        "Subscription",
                        "Error occurred parsing Data",
                        Object {
                          "error": [Error: Parsing failed],
                          "schemaName": "Price",
                          "servicePath": "servicePath",
                          "url": "src/test/resource",
                        },
                      ],
                    ]
                `);
                logError.mockClear();
            });
        });
    });

    describe('json parsing', () => {
        it('should parse data without schema', async () => {
            const args = {
                Format: 'application/json',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                args,

                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0][0]).toEqual(
                expect.objectContaining(mockProtoPrice.objectMessage),
            );
        });

        it('should default to json if format is not provided', async () => {
            const args = {
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                args,

                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);
            expect(updateSpy.mock.calls[0][0]).toEqual(
                expect.objectContaining(mockProtoPrice.objectMessage),
            );
        });

        it('should parse streaming update', async () => {
            const args = {
                Format: 'application/json',
                Arguments: {
                    ClientKey: '1234',
                },
            };
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                args,

                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: mockProtoPrice.objectMessage,
            });

            await wait();
            expect(transport.post.mock.calls.length).toEqual(1);

            const streamingData = {
                ReferenceId: subscription.referenceId as string,
                Data: mockProtoPrice.objectMessage,
            };

            subscription.onStreamingData(streamingData);

            const [lastMessageArgument, lastTypeArgument] =
                updateSpy.mock.calls[updateSpy.mock.calls.length - 1];

            expect(lastTypeArgument).toEqual(subscription.UPDATE_TYPE_DELTA);
            expect(lastMessageArgument.Data).toEqual(
                expect.objectContaining(mockProtoPrice.objectMessage),
            );
        });
    });

    describe('modify behaviour', () => {
        it('calls patch on modify with patch method option', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const newArgs = {
                newArgs: 'newArgs',
                testArgs: 'test',
            };
            const patchArgsDelta = { testArgs: 'argsDelta' };
            subscription.onModify(newArgs, {
                isPatch: true,
                isReplace: false,
                patchArgsDelta,
            });
            // new arguments assigned to the subscription
            expect(subscription.subscriptionData.Arguments).toEqual({
                newArgs: 'newArgs',
                testArgs: 'test',
            });
            // sends patch request on modify
            expect(transport.patch.mock.calls.length).toEqual(1);
        });

        it('resubscribes in one HTTP call with new arguments on modify with replace method option', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();
            transport.post.mockClear();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const previousReferenceId = subscription.referenceId;
            const newArgs = { newArgs: 'test' };
            subscription.onModify(newArgs, {
                isReplace: true,
            });
            // subscribed with new arguments
            expect(subscription.subscriptionData.Arguments).toEqual(newArgs);
            // requests delete as part of the subscribe call
            expect(transport.delete).not.toBeCalled();
            expect(transport.post).toBeCalledWith(
                'servicePath',
                'src/test/resource',
                null,
                {
                    body: expect.objectContaining({
                        ReplaceReferenceId: previousReferenceId,
                    }),
                },
            );
        });

        it('resubscribes with new arguments on modify without patch method option', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const newArgs = { newArgs: 'test' };
            subscription.onModify(newArgs);
            // subscribed with new arguments
            expect(subscription.subscriptionData.Arguments).toEqual(newArgs);
            // sends delete request on modify
            expect(transport.delete.mock.calls.length).toEqual(1);
            expect(transport.post.mock.calls.length).toEqual(1);
        });

        it('sends next patch request only after previous patch completed', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                { onUpdate: updateSpy, onSubscriptionCreated: createdSpy },
            );

            const initialArgs = { initialArgs: 'initialArgs' };
            subscription.subscriptionData.Arguments = initialArgs;
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const args = { args: 'args' };
            const newArgs = { args: 'newArgs' };
            subscription.onModify(args, {
                isPatch: true,
                isReplace: false,
                patchArgsDelta: { newArgs: 'firstArgs' },
            });
            subscription.onModify(newArgs, {
                isPatch: true,
                isReplace: false,
                patchArgsDelta: { newArgs: 'secondArgs' },
            });

            expect(transport.patch.mock.calls.length).toEqual(1);
            // first patch arguments sent
            expect(transport.patch.mock.calls[0][3].body).toEqual({
                newArgs: 'firstArgs',
            });

            transport.patchResolve({ status: '200', response: '' });

            await wait();
            expect(transport.patch.mock.calls.length).toEqual(2);
            // second patch arguments sent
            expect(transport.patch.mock.calls[1][3].body).toEqual({
                newArgs: 'secondArgs',
            });
            expect(subscription.subscriptionData.Arguments).toEqual(newArgs);
        });

        it('handles modify patch success and then reset', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const patchArgsDelta = { argsDelta: 'argsDelta' };
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );

            subscription.onModify(
                { newArgs: 'test' },
                { isPatch: true, isReplace: false, patchArgsDelta },
            );
            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );
            subscription.reset(true);
            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );

            // patch comes back successful
            transport.patchReject({
                status: '200',
                response: '',
            });

            await wait();

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );

            // delete is done and can now be resolved
            transport.deleteResolve({ status: '200', response: '' });
            await wait();
            // subscribe occurs
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
        });

        it('handles modify patch when currently waiting to subscribe', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            subscription.onUnsubscribe();

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );

            subscription.onSubscribe();

            const patchArgsDelta = { argsDelta: 'argsDelta' };
            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );

            subscription.onModify(
                { newArgs: 'test' },
                { isPatch: true, isReplace: false, patchArgsDelta },
            );

            transport.deleteResolve({ status: '200', response: {} });

            await wait();

            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();

            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );
            expect(subscription.queue.items).toHaveLength(0);
        });

        it('handles modify patch error and then reset', async () => {
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            const patchArgsDelta = { argsDelta: 'argsDelta' };
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBED,
            );

            subscription.onModify(
                { newArgs: 'test' },
                { isPatch: true, isReplace: false, patchArgsDelta },
            );
            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );
            subscription.reset(true);

            expect(subscription.currentState).toEqual(
                subscription.STATE_PATCH_REQUESTED,
            );

            // patch comes back
            transport.patchReject({
                status: '500',
                response: 'Subscription no longer exists!',
            });

            await wait();

            expect(subscription.currentState).toEqual(
                subscription.STATE_UNSUBSCRIBE_REQUESTED,
            );

            // delete done at the same time comes back
            transport.deleteResolve({ status: '200', response: '' });
            await wait();
            expect(subscription.currentState).toEqual(
                subscription.STATE_SUBSCRIBE_REQUESTED,
            );
        });

        it('handles modify replace error', async () => {
            const onError = jest.fn();
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onError,
                },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            expect(subscription.currentState).toBe(
                subscription.STATE_SUBSCRIBED,
            );

            subscription.onModify({ newArgs: 'test' }, { isReplace: true });
            expect(subscription.currentState).toBe(
                subscription.STATE_REPLACE_REQUESTED,
            );
            expect(onError).not.toBeCalled();

            transport.postReject({
                status: '500',
                response: 'Internal server error',
            });

            await wait();
            expect(subscription.currentState).toBe(
                subscription.STATE_UNSUBSCRIBED,
            );
            expect(onError).toBeCalled();
        });

        it('handles modify replace network error', async () => {
            const onError = jest.fn();
            const subscription = new Subscription(
                '123',
                transport,
                'servicePath',
                'src/test/resource',
                {},
                {
                    onError,
                },
            );
            subscription.onSubscribe();

            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            expect(subscription.currentState).toBe(
                subscription.STATE_SUBSCRIBED,
            );

            subscription.onModify({ newArgs: 'test' }, { isReplace: true });
            expect(subscription.currentState).toBe(
                subscription.STATE_REPLACE_REQUESTED,
            );
            expect(onError).not.toBeCalled();

            transport.postReject({
                isNetworkError: true,
            });

            await wait();
            expect(subscription.currentState).toBe(
                subscription.STATE_UNSUBSCRIBED,
            );
            expect(onError).not.toBeCalled();

            tick(5000);
            sendInitialResponse({
                InactivityTimeout: 100,
                Snapshot: { resetResponse: true },
            });

            await wait();
            expect(subscription.currentState).toBe(
                subscription.STATE_SUBSCRIBED,
            );
        });
    });
});
