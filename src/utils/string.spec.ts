import { startsWith, endsWith } from './string';

describe('utils string', () => {
    describe('startsWith', () => {
        it('works', () => {
            expect(startsWith('haystack', 'needle')).toEqual(false);
            expect(startsWith('haystack', 'hay')).toEqual(true);
            expect(startsWith('haystack', 'needle', false)).toEqual(false);
            expect(startsWith('haystack', 'hay', false)).toEqual(true);
            expect(startsWith('HaYstack', 'hAy', false)).toEqual(true);
        });
    });

    describe('endsWith', () => {
        it('works', () => {
            expect(endsWith('haystack', 'needle')).toEqual(false);
            expect(endsWith('haystack', 'stack')).toEqual(true);
            expect(endsWith('haystack', 'needle', false)).toEqual(false);
            expect(endsWith('haystack', 'stack', false)).toEqual(true);
            expect(endsWith('hatStacK', 'sTACk', false)).toEqual(true);
        });
    });
});
