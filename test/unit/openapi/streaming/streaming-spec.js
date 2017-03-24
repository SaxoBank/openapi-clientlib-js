import { global, installClock, uninstallClock, mockDate } from '../../utils';
import mockTransport from '../../mocks/transport';
import '../../mocks/math-random';

const Streaming = saxo.openapi.Streaming;

var stateChangedCallback, connectionSlowCallback, startCallback, receivedCallback, errorCallback;
var authProvider, mockConnection;
var subscriptionUpdateSpy, subscriptionErrorSpy;

var transport;

describe("openapi Streaming", () => {
    beforeEach(() => {

        mockConnection = jasmine.createSpyObj("mockConnection", ["stateChanged", "start", "received", "error", "connectionSlow", "stop"]);
        mockConnection.stateChanged.and.callFake((callback) => { stateChangedCallback = callback; });
        mockConnection.start.and.callFake((options, callback) => { startCallback = callback; });
        mockConnection.received.and.callFake((callback) => { receivedCallback = callback; });
        mockConnection.error.and.callFake((callback) => { errorCallback = callback; });
        mockConnection.connectionSlow.and.callFake((callback) => { connectionSlowCallback = callback; });

        spyOn(global.$, "connection").and.returnValue(mockConnection);
        transport = mockTransport();
        authProvider = jasmine.createSpyObj("auth", ["getToken"]);
        authProvider.getToken.and.callFake(() => "TOKEN");

        subscriptionUpdateSpy = jasmine.createSpy("subscriptionUpdate");
        subscriptionErrorSpy = jasmine.createSpy("subscriptionError");
        installClock();
    });
    afterEach(() => uninstallClock());

    describe("init", () => {
        it("initializes the connection", () => {

            var streaming = new Streaming(transport, 'testUrl', authProvider);
            expect(global.$.connection.calls.count()).toEqual(1);
            expect(global.$.connection.calls.argsFor(0)).toEqual(['testUrl/streaming/connection']);
            expect(streaming.connection.qs).toEqual('authorization=TOKEN&context=0000000000');
        });
    });

    describe("connection states", () => {

        var streaming, subscription, stateChangedSpy;

        function givenStreaming(options) {
            streaming = new Streaming(transport, 'testUrl', authProvider, options);
            subscription = streaming.createSubscription("root", "/test/test", {}, subscriptionUpdateSpy, subscriptionErrorSpy);
            subscription.onConnectionAvailable = jasmine.createSpy("onConnectionAvailable");
            subscription.onConnectionUnavailable = jasmine.createSpy("onConnectionUnavailable");
            subscription.reset = jasmine.createSpy("reset");
            subscription.dispose = jasmine.createSpy("dispose");
            stateChangedSpy = jasmine.createSpy("stateChanged");
            streaming.on("connectionStateChanged", stateChangedSpy);
            return streaming;
        }

        it("is initially initialising", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_INITIALIZING);
        });

        it("tells subscriptions it is not connected when they are created before connect", () => {
            givenStreaming();
            // we test the property because we get the subscription after unavailable has been called, and before we spy on the method
            expect(subscription.connectionAvailable).toEqual(false);
        });
        it("tells subscriptions it is connected when they are created after connect", () => {
            givenStreaming();
            stateChangedCallback({newState:1 /* connected */});
            subscription = streaming.createSubscription("root", "/test/test", {}, subscriptionUpdateSpy, subscriptionErrorSpy);
            // we test the property because we get the subscription after unavailable has been called, and before we spy on the method
            expect(subscription.connectionAvailable).toEqual(true);
        });

        it("does not cross communicate between two streaming instances", () => {
            var streaming1 = givenStreaming();
            var streaming2 = givenStreaming();
            startCallback();
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_STARTED);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_STARTED]);
        });
        it("becomes started when the connection callback returns", () => {
            givenStreaming();
            startCallback();
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_STARTED);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_STARTED]);
        });
        it("goes to the connecting state", () => {
            givenStreaming();
            stateChangedCallback({newState:0 /* connecting */});
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_CONNECTING);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_CONNECTING]);

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(0);
        });
        it("goes to the connected state", () => {
            givenStreaming();
            stateChangedCallback({newState:1 /* connected */});
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_CONNECTED);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_CONNECTED]);

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(1);
            expect(subscription.onConnectionAvailable.calls.argsFor(0)).toEqual([]);
        });
        it("stays connected if started is called after connected state change", () => {
            // this does happen - timing can go either way in the wild
            givenStreaming();
            stateChangedCallback({newState:1 /* connected */});
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_CONNECTED);
            startCallback();
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_CONNECTED);
        });
        it("goes to the reconnected state", () => {
            givenStreaming();
            stateChangedCallback({newState:2 /* reconnecting */});
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_RECONNECTING);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_RECONNECTING]);

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(0);
        });
        it("goes to the disconnected state", () => {
            givenStreaming();
            stateChangedCallback({newState:4 /* disconnected */});
            expect(streaming.connectionState).toEqual(streaming.CONNECTION_STATE_DISCONNECTED);

            expect(stateChangedSpy.calls.count()).toEqual(1);
            expect(stateChangedSpy.calls.argsFor(0)).toEqual([streaming.CONNECTION_STATE_DISCONNECTED]);

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(0);
        });

        it("if signal-r is reconnecting, it does not reset but it does tell the subscription the connection is available", () => {
            givenStreaming();
            stateChangedCallback({newState:1 /* connected */});
            stateChangedCallback({newState:2 /* reconnecting */});
            stateChangedCallback({newState:1 /* connected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(2);
            expect(subscription.reset.calls.count()).toEqual(0);
        });

        it("if signal-r disconnects, it tries to connect and resets subscriptions", () => {
            givenStreaming();
            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});
            stateChangedCallback({newState:4 /* disconnected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(1);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(0);

            jasmine.clock().tick(1000); // default connection retry delay

            expect(mockConnection.start.calls.count()).toEqual(2);
            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(2);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);
        });

        it("if signal-r disconnects, it tries to connect and resets subscriptions, if the retry delay is 0", () => {
            givenStreaming({connectRetryDelay: 0});
            jasmine.clock().tick(1); // make sure the context id is different (in reality we will never be disconnected 0ms after starting to connect)

            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});
            stateChangedCallback({newState:4 /* disconnected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(1);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(0);
            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(streaming.contextId);

            jasmine.clock().tick(0);

            expect(mockConnection.start.calls.count()).toEqual(2);
            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(2);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);

            expect(subscription.streamingContextId).toEqual('0000000100');
            expect(subscription.streamingContextId).toEqual(streaming.contextId);

        });

        it("if signal-r disconnects, it tries to connect and resets subscriptions, if the retry delay is 600,000", () => {
            givenStreaming({connectRetryDelay: 600000});
            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});
            stateChangedCallback({newState:4 /* disconnected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(1);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(0);
            expect(subscription.streamingContextId).toEqual('0000000000');
            expect(subscription.streamingContextId).toEqual(streaming.contextId);

            jasmine.clock().tick(600000);

            expect(mockConnection.start.calls.count()).toEqual(2);
            stateChangedCallback({newState:0 /* connecting */});
            stateChangedCallback({newState:1 /* connected */});

            expect(subscription.onConnectionAvailable.calls.count()).toEqual(2);
            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);

            expect(subscription.streamingContextId).toEqual('0060000000');
            expect(subscription.streamingContextId).toEqual(streaming.contextId);
        });
    });

    describe("data received", () => {
        it("splits the data and emits each result", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);

            var subscription = jasmine.createSpyObj("subscription", ["onStreamingData"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            var subscription2 = jasmine.createSpyObj("subscription", ["onStreamingData"]);
            subscription2.referenceId = "MySpy2";
            streaming.subscriptions.push(subscription2);

            var data1 = { ReferenceId: "MySpy", Data: "one" };
            var data2 = { ReferenceId: "MySpy2", Data: "two" };
            receivedCallback([data1, data2]);

            expect(subscription.onStreamingData.calls.count()).toEqual(1);
            expect(subscription.onStreamingData.calls.argsFor(0)).toEqual([data1]);

            expect(subscription2.onStreamingData.calls.count()).toEqual(1);
            expect(subscription2.onStreamingData.calls.argsFor(0)).toEqual([data2]);
        });
        it("handles a null received event", () => {
            expect(() => {
                new Streaming(transport, 'testUrl', authProvider);

                receivedCallback(null);
            }).not.toThrow();
        });
        it("handles data for a subscription not present", () => {
            expect(() => {
                new Streaming(transport, 'testUrl', authProvider);

                var data1 = { ReferenceId: "MySpy", Data: "one" };
                receivedCallback([data1]);
            }).not.toThrow();
        });
        it("handles a update without a reference id", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);

            var subscription = jasmine.createSpyObj("subscription", ["onStreamingData"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);

            var data1 = { }; // using this to throw an exception, but could be anything
            var data2 = { ReferenceId: "MySpy", Data: "one" };
            receivedCallback([data1, data2]);

            expect(subscription.onStreamingData.calls.count()).toEqual(1);
            expect(subscription.onStreamingData.calls.argsFor(0)).toEqual([data2]);
        });
    });

    describe("signal-r events", () => {
        var streaming;
        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
        });

        it("handles connection slow events", () => {
            var connectionSlowSpy = jasmine.createSpy("spyOnConnectionSlow");
            streaming.on(streaming.EVENT_CONNECTION_SLOW, connectionSlowSpy);
            connectionSlowCallback();
            expect(connectionSlowSpy.calls.count()).toEqual(1);
        });
        it("handles connection error events", () => {
            spyOn(saxo.log, "error");
            errorCallback("error details");
            expect(saxo.log.error.calls.count()).toEqual(1);
        });
        it("handles signal-r log calls", () => {
            spyOn(saxo.log, "debug");
            mockConnection.log("my message");
            expect(saxo.log.debug.calls.count()).toEqual(1);
        });
    });

    describe("control messages", () => {
        var streaming, subscription;
        beforeEach(() => {
            streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState:1 /* connected */});
            subscription = jasmine.createSpyObj("subscription", ["onStreamingData", "reset", "onHeartbeat"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
        });

        it("handles heartbeats", () => {
            expect(subscription.onHeartbeat.calls.count()).toEqual(0);
            receivedCallback([{ ReferenceId: "_heartbeat", Heartbeats: [{OriginatingReferenceId: "MySpy"}]}]);
            expect(subscription.onHeartbeat.calls.count()).toEqual(1);
            expect(subscription.onHeartbeat.calls.argsFor(0)).toEqual([]);
            expect(subscription.reset.calls.count()).toEqual(0);
        });
        it("handles and ignores heartbeats for a subscription not present", () => {
            expect(subscription.onHeartbeat.calls.count()).toEqual(0);
            receivedCallback([{ ReferenceId: "_heartbeat", Heartbeats: [{OriginatingReferenceId: "foo"}]}]);
            expect(subscription.onHeartbeat.calls.count()).toEqual(0);
            expect(subscription.reset.calls.count()).toEqual(0);
        });
        it("handles reset", () => {
            receivedCallback([{ ReferenceId: "_resetsubscriptions", TargetReferenceIds: ["MySpy"]}]);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);
        });
        it("handles and ignores reset for a subscription not present", () => {
            receivedCallback([{ ReferenceId: "_resetsubscriptions", TargetReferenceIds: ["foo"]}]);
            expect(subscription.reset.calls.count()).toEqual(0);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);
        });
        it("handles reset all", () => {
            receivedCallback([{ ReferenceId: "_resetsubscriptions" }]);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);
        });
        it("handles reset all for empty TargetReferenceIds array", () => {
            receivedCallback([{ ReferenceId: "_resetsubscriptions", TargetReferenceIds: []}]);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(subscription.reset.calls.argsFor(0)).toEqual([]);
        });
        it("handles an unknown control event", () => {
            receivedCallback([{ ReferenceId: "_foo", TargetReferenceIds: ["MySpy"]}]);
            expect(subscription.reset.calls.count()).toEqual(0);
        });
    });

    describe("dispose", () => {
        it("unsubscribes everything", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["onConnectionUnavailable", "reset"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            expect(mockConnection.start.calls.count()).toEqual(1);
            mockConnection.start.calls.reset();

            spyOn(streaming.orphanFinder, "stop");

            streaming.dispose();

            expect(subscription.onConnectionUnavailable.calls.count()).toEqual(1);
            expect(subscription.reset.calls.count()).toEqual(1);
            expect(transport.delete.calls.count()).toEqual(1);
            expect(transport.delete.calls.argsFor(0)[0]).toEqual("root");
            expect(transport.delete.calls.argsFor(0)[1]).toEqual("v1/subscriptions/{contextId}");
            expect(transport.delete.calls.argsFor(0)[2]).toEqual({ contextId: "0000000000" });
            expect(streaming.orphanFinder.stop.calls.count()).toEqual(1);

            stateChangedCallback({newState:4 /* disconnected */});

            jasmine.clock().tick(10000);
            expect(mockConnection.start.calls.count()).toEqual(0);
        });

        it("disposes an individual subscription", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["onUnsubscribe", "dispose"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            var subscription2 = jasmine.createSpyObj("subscription", ["onUnsubscribe", "dispose"]);
            subscription2.referenceId = "MySpy";
            streaming.subscriptions.push(subscription2);

            streaming.disposeSubscription(subscription);

            expect(subscription.onUnsubscribe.calls.count()).toEqual(1);
            expect(subscription.dispose.calls.count()).toEqual(1);
            expect(streaming.subscriptions.length).toEqual(1);

            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.calls.count()).toEqual(1);
            expect(subscription2.dispose.calls.count()).toEqual(1);
            expect(streaming.subscriptions.length).toEqual(0);

            // copes with being called twice

            streaming.disposeSubscription(subscription2);

            expect(subscription2.onUnsubscribe.calls.count()).toEqual(2);
            expect(subscription2.dispose.calls.count()).toEqual(2);
            expect(streaming.subscriptions.length).toEqual(0);
        });
    });

    describe("subscription handling", () => {

        it("when a subscription is orphaned, the subscription is reset", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["reset"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            expect(subscription.reset.calls.count()).toEqual(0);

            streaming.orphanFinder.onOrphanFound(subscription);

            expect(subscription.reset.calls.count()).toEqual(1);
        });

        it("passes on subscribe calls", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["onSubscribe"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            expect(subscription.onSubscribe.calls.count()).toEqual(0);

            streaming.subscribe(subscription);

            expect(subscription.onSubscribe.calls.count()).toEqual(1);
        });

        it("updates the orphan finder when a subscription is created", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            var subscription = streaming.createSubscription("root", "/test/test", {}, subscriptionUpdateSpy, subscriptionErrorSpy);

            spyOn(streaming.orphanFinder, "update");
            subscription.onSubscriptionCreated();

            expect(streaming.orphanFinder.update.calls.count()).toEqual(1);
        });

        it("passes on subscribe calls", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["onUnsubscribe"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);
            expect(subscription.onUnsubscribe.calls.count()).toEqual(0);

            streaming.unsubscribe(subscription);

            expect(subscription.onUnsubscribe.calls.count()).toEqual(1);
        });

        it("passes options on modify", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            stateChangedCallback({newState: 1 /* connected */});

            var subscription = jasmine.createSpyObj("subscription", ["onModify"]);
            subscription.referenceId = "MySpy";
            streaming.subscriptions.push(subscription);

            const args = "SubscriptionArgs";
            const options = { test: 'test options' };
            streaming.modify(subscription, args, options);

            expect(subscription.onModify.calls.count()).toEqual(1);
            expect(subscription.onModify.calls.mostRecent().args[0]).toEqual(args);
            expect(subscription.onModify.calls.mostRecent().args[1]).toEqual(options);
        });
    });

    describe("options", () => {
        it("has defaults", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider);
            expect(mockConnection.start.calls.count()).toEqual(1);
            expect(mockConnection.start.calls.argsFor(0)[0]).toEqual({ waitForPageLoad: false, transport: [ 'webSockets', ' longPolling' ] });
        });

        it("can override waitForPageLoad", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider, {waitForPageLoad: true});
            expect(mockConnection.start.calls.count()).toEqual(1);
            expect(mockConnection.start.calls.argsFor(0)[0]).toEqual({ waitForPageLoad: true, transport: [ 'webSockets', ' longPolling' ] });
        });

        it("can override transport", () => {
            var streaming = new Streaming(transport, 'testUrl', authProvider, {transportTypes: ['webSockets']});
            expect(mockConnection.start.calls.count()).toEqual(1);
            expect(mockConnection.start.calls.argsFor(0)[0]).toEqual({ waitForPageLoad: false, transport: [ 'webSockets' ] });
        });
    });
});
