import log from './log';

describe('log', () => {
    it('works when it has no subscribers', () => {
        expect(function() {
            log.info('area', 'testing info', {});
            log.debug('area', 'testing debug', {});
            log.warn('area', 'testing warn', {});
            log.error('area', 'testing error', {});
        }).not.toThrow();
    });

    it('works when it has subscribers', () => {
        const expectedContextObject = { foo: 'bar' };

        const debugSpy = jest.fn().mockName(log.DEBUG);
        log.on(log.DEBUG, debugSpy, expectedContextObject);
        const infoSpy = jest.fn().mockName(log.INFO);
        log.on(log.INFO, infoSpy, expectedContextObject);
        const warnSpy = jest.fn().mockName(log.WARN);
        log.on(log.WARN, warnSpy, expectedContextObject);
        const errorSpy = jest.fn().mockName(log.ERROR);
        log.on(log.ERROR, errorSpy, expectedContextObject);

        log.debug('area1', 'testing debug', { info: 'info1' });
        log.info('area2', 'testing info', { info: 'info2' });
        log.warn('area3', 'testing warn', { info: 'info3' });
        log.error('area4', 'testing error', { info: 'info4' });

        expect(debugSpy.mock.calls.length).toEqual(1);
        expect(infoSpy.mock.calls.length).toEqual(1);
        expect(warnSpy.mock.calls.length).toEqual(1);
        expect(errorSpy.mock.calls.length).toEqual(1);

        expect(debugSpy.mock.calls[0]).toEqual([
            'area1',
            'testing debug',
            { info: 'info1' },
        ]);
        expect(infoSpy.mock.calls[0]).toEqual([
            'area2',
            'testing info',
            { info: 'info2' },
        ]);
        expect(warnSpy.mock.calls[0]).toEqual([
            'area3',
            'testing warn',
            { info: 'info3' },
        ]);
        expect(errorSpy.mock.calls[0]).toEqual([
            'area4',
            'testing error',
            { info: 'info4' },
        ]);
        expect(debugSpy.mock.instances[0]).toEqual(expectedContextObject);
        expect(infoSpy.mock.instances[0]).toEqual(expectedContextObject);
        expect(warnSpy.mock.instances[0]).toEqual(expectedContextObject);
        expect(errorSpy.mock.instances[0]).toEqual(expectedContextObject);

        log.debug('area2', 'testing debug', { info: 'info6' });
        expect(debugSpy.mock.calls.length).toEqual(2);
        expect(infoSpy.mock.calls.length).toEqual(1);
    });
});
