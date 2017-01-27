var eventEmitter, spyTest, spyTest1, spyOrange;

describe("microEmitter", () => {
	beforeEach(() => {
		eventEmitter = {};
		saxo.microEmitter.mixinTo(eventEmitter);
		spyTest = jasmine.createSpy("test");
		spyTest1 = jasmine.createSpy("test1");
		spyOrange = jasmine.createSpy("orange");
	});

	it("copes with no subscribers", () => {
		expect(() => eventEmitter.trigger("test"))
			.not.toThrow();
	});
	it("triggers an event and sends to subscribers when subscribed", () => {
		eventEmitter.trigger("test");
		eventEmitter.on("test", spyTest);
		eventEmitter.on("orange", spyOrange);

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyOrange.calls.count()).toEqual(0);

		eventEmitter.trigger("test", 1, 2, 3, 4);

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest.calls.argsFor(0)).toEqual([1, 2, 3, 4]);
		spyTest.calls.reset();
		expect(spyOrange.calls.count()).toEqual(0);

		eventEmitter.off("test", spyTest);
		eventEmitter.off("orange", spyOrange);

		eventEmitter.trigger("test", 1, 2, 3, 4);

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyOrange.calls.count()).toEqual(0);
	});

	it("uses the context", () => {
		eventEmitter.trigger("test");
		var contextOne = {myTest: true};
		eventEmitter.on("test", spyTest, contextOne);

		expect(spyTest.calls.count()).toEqual(0);
		eventEmitter.trigger("test");
		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest.calls.first().object).toBe(contextOne);
		spyTest.calls.reset();

		// does not unsubscribe because we gave it a context. otherwise we risk people making the mistake of unsubscribing every instance
		eventEmitter.off("test", spyTest);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		spyTest.calls.reset();

		// now it has a context it actually subscribes
		eventEmitter.off("test", spyTest, contextOne);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(0);
	});

	it("allows multiple subscribers", () => {
		eventEmitter.trigger("test");

		eventEmitter.on("test", spyTest);
		eventEmitter.on("test", spyTest1);

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyTest1.calls.count()).toEqual(0);

		eventEmitter.trigger("test", 1, 2, 3, 4);

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest.calls.argsFor(0)).toEqual([1, 2, 3, 4]);
		spyTest.calls.reset();
		expect(spyTest1.calls.count()).toEqual(1);
		expect(spyTest1.calls.argsFor(0)).toEqual([1, 2, 3, 4]);
		spyTest1.calls.reset();

		eventEmitter.off("test", spyTest);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyTest1.calls.count()).toEqual(1);
		spyTest1.calls.reset();

		eventEmitter.off("test", spyTest1);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyTest1.calls.count()).toEqual(0);
	});

	it("can cope with being unsubscribed whilst processing - before", () => {

		// the first added subscriber spyTest unsubscribes
		eventEmitter.on("test", spyTest);
		eventEmitter.on("test", spyTest1);

		spyTest.and.callFake(() => eventEmitter.off("test", spyTest));

		eventEmitter.trigger("test");
		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest1.calls.count()).toEqual(2);
	});

	it("can cope with being unsubscribed whilst processing - after", () => {

		// the second added subscriber spyTest unsubscribes
		eventEmitter.on("test", spyTest1);
		eventEmitter.on("test", spyTest);

		spyTest.and.callFake(() => eventEmitter.off("test", spyTest));

		eventEmitter.trigger("test");
		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest1.calls.count()).toEqual(2);
	});

	it("can cope with being unsubscribed whilst processing - both", () => {

		eventEmitter.on("test", spyTest1);
		eventEmitter.on("test", spyTest);

		spyTest.and.callFake(() => eventEmitter.off("test", spyTest));
		spyTest1.and.callFake(() => eventEmitter.off("test", spyTest1));

		eventEmitter.trigger("test");
		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest1.calls.count()).toEqual(1);
	});

	it("can cope with being subscribed whilst processing", () => {

		eventEmitter.on("test", spyTest);

		spyTest.and.callFake(() => eventEmitter.on("test", spyTest1));

		eventEmitter.trigger("test");
		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(2);
		expect(spyTest1.calls.count()).toEqual(1);
	});

	it("can cope with multiple calls to off", () => {

		eventEmitter.on("test", spyTest);
		eventEmitter.on("test", spyTest1);
		eventEmitter.off("test", spyTest1);
		eventEmitter.off("test", spyTest1);
		eventEmitter.off("test", spyTest1);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest1.calls.count()).toEqual(0);
	});

	it("can unsubscribe multiple on's by context", () => {

		var context = {};
		eventEmitter.on("test", spyTest, context);
		eventEmitter.on("test", spyTest1, context);
		eventEmitter.on("orange", spyOrange, context);

		eventEmitter.off(null, null, context);

		eventEmitter.trigger("test");
		eventEmitter.trigger("orange");

		expect(spyTest.calls.count()).toEqual(0);
		expect(spyTest1.calls.count()).toEqual(0);
		expect(spyOrange.calls.count()).toEqual(0);
	});

	it("triggers a one() registered subscriber once", () => {

		eventEmitter.one("test", spyTest);
		eventEmitter.on("test", spyTest1);

		eventEmitter.trigger("test");
		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(1);
		expect(spyTest1.calls.count()).toEqual(2);
	});

	it("only triggers a one() registered subscriber once with recursive event", () => {

		eventEmitter.on("test", spyTest1);
		eventEmitter.one('test', () => eventEmitter.trigger('test'));

		eventEmitter.trigger('test');

		expect(spyTest1.calls.count()).toEqual(2);
	});

    it("can unsubscribe a one() registered subscriber", () => {

		eventEmitter.one("test", spyTest);
        eventEmitter.off("test", spyTest);

		eventEmitter.trigger("test");

		expect(spyTest.calls.count()).toEqual(0);
	});
});
