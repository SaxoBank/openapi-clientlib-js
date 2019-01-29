import microEmitter from './micro-emitter';

describe('microEmitter', () => {
    let eventEmitter;
    let spyTest;
    let spyTest1;
    let spyOrange;

    beforeEach(() => {
        eventEmitter = {};
        microEmitter.mixinTo(eventEmitter);
        spyTest = jest.fn().mockName('test');
        spyTest1 = jest.fn().mockName('test1');
        spyOrange = jest.fn().mockName('orange');
    });

    it('copes with no subscribers', () => {
        expect(() => eventEmitter.trigger('test'))
            .not.toThrow();
    });
    it('triggers an event and sends to subscribers when subscribed', () => {
        eventEmitter.trigger('test');
        eventEmitter.on('test', spyTest);
        eventEmitter.on('orange', spyOrange);

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyOrange.mock.calls.length).toEqual(0);

        eventEmitter.trigger('test', 1, 2, 3, 4);

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest.mock.calls[0]).toEqual([1, 2, 3, 4]);
        spyTest.mockClear();
        expect(spyOrange.mock.calls.length).toEqual(0);

        eventEmitter.off('test', spyTest);
        eventEmitter.off('orange', spyOrange);

        eventEmitter.trigger('test', 1, 2, 3, 4);

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyOrange.mock.calls.length).toEqual(0);
    });

    it('uses the context', () => {
        eventEmitter.trigger('test');
        const contextOne = { myTest: true };
        eventEmitter.on('test', spyTest, contextOne);

        expect(spyTest.mock.calls.length).toEqual(0);
        eventEmitter.trigger('test');
        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest.mock.instances[0]).toBe(contextOne);
        spyTest.mockClear();

        // does not unsubscribe because we gave it a context. otherwise we risk people making the mistake of unsubscribing every instance
        eventEmitter.off('test', spyTest);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        spyTest.mockClear();

        // now it has a context it actually subscribes
        eventEmitter.off('test', spyTest, contextOne);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(0);
    });

    it('allows multiple subscribers', () => {
        eventEmitter.trigger('test');

        eventEmitter.on('test', spyTest);
        eventEmitter.on('test', spyTest1);

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyTest1.mock.calls.length).toEqual(0);

        eventEmitter.trigger('test', 1, 2, 3, 4);

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest.mock.calls[0]).toEqual([1, 2, 3, 4]);
        spyTest.mockClear();
        expect(spyTest1.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls[0]).toEqual([1, 2, 3, 4]);
        spyTest1.mockClear();

        eventEmitter.off('test', spyTest);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyTest1.mock.calls.length).toEqual(1);
        spyTest1.mockClear();

        eventEmitter.off('test', spyTest1);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyTest1.mock.calls.length).toEqual(0);
    });

    it('can cope with being unsubscribed whilst processing - before', () => {

        // the first added subscriber spyTest unsubscribes
        eventEmitter.on('test', spyTest);
        eventEmitter.on('test', spyTest1);

        spyTest.mockImplementation(() => eventEmitter.off('test', spyTest));

        eventEmitter.trigger('test');
        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls.length).toEqual(2);
    });

    it('can cope with being unsubscribed whilst processing - after', () => {

        // the second added subscriber spyTest unsubscribes
        eventEmitter.on('test', spyTest1);
        eventEmitter.on('test', spyTest);

        spyTest.mockImplementation(() => eventEmitter.off('test', spyTest));

        eventEmitter.trigger('test');
        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls.length).toEqual(2);
    });

    it('can cope with being unsubscribed whilst processing - both', () => {

        eventEmitter.on('test', spyTest1);
        eventEmitter.on('test', spyTest);

        spyTest.mockImplementation(() => eventEmitter.off('test', spyTest));
        spyTest1.mockImplementation(() => eventEmitter.off('test', spyTest1));

        eventEmitter.trigger('test');
        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls.length).toEqual(1);
    });

    it('can cope with being subscribed whilst processing', () => {

        eventEmitter.on('test', spyTest);

        spyTest.mockImplementation(() => eventEmitter.on('test', spyTest1));

        eventEmitter.trigger('test');
        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(2);
        expect(spyTest1.mock.calls.length).toEqual(1);
    });

    it('can cope with multiple calls to off', () => {

        eventEmitter.on('test', spyTest);
        eventEmitter.on('test', spyTest1);
        eventEmitter.off('test', spyTest1);
        eventEmitter.off('test', spyTest1);
        eventEmitter.off('test', spyTest1);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls.length).toEqual(0);
    });

    it('can unsubscribe multiple on\'s by context', () => {

        const context = {};
        eventEmitter.on('test', spyTest, context);
        eventEmitter.on('test', spyTest1, context);
        eventEmitter.on('orange', spyOrange, context);

        eventEmitter.off(null, null, context);

        eventEmitter.trigger('test');
        eventEmitter.trigger('orange');

        expect(spyTest.mock.calls.length).toEqual(0);
        expect(spyTest1.mock.calls.length).toEqual(0);
        expect(spyOrange.mock.calls.length).toEqual(0);
    });

    it('triggers a one() registered subscriber once', () => {

        eventEmitter.one('test', spyTest);
        eventEmitter.on('test', spyTest1);

        eventEmitter.trigger('test');
        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(1);
        expect(spyTest1.mock.calls.length).toEqual(2);
    });

    it('only triggers a one() registered subscriber once with recursive event', () => {

        eventEmitter.on('test', spyTest1);
        eventEmitter.one('test', () => eventEmitter.trigger('test'));

        eventEmitter.trigger('test');

        expect(spyTest1.mock.calls.length).toEqual(2);
    });

    it('can unsubscribe a one() registered subscriber', () => {

        eventEmitter.one('test', spyTest);
        eventEmitter.off('test', spyTest);

        eventEmitter.trigger('test');

        expect(spyTest.mock.calls.length).toEqual(0);
    });
});
