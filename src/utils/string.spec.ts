import { startsWith, endsWith, format, padLeft, formatUrl } from './string';

describe('String utils', () => {
    it('format sets proper arguments to placeholders', () => {
        const expected = 'lorem ipsum dolor sit amet';

        expect(
            format('lorem {foo} dolor {bar} amet', {
                foo: 'ipsum',
                bar: 'sit',
            }),
        ).toBe(expected);

        expect(format('lorem {0} dolor {1} amet', 'ipsum', 'sit')).toBe(
            expected,
        );

        expect(format('lorem {foo} dolor {1} amet', 'ipsum', 'sit')).toBe(
            'lorem {foo} dolor sit amet',
        );
    });

    it('startsWith works', () => {
        expect(startsWith('haystack', 'needle')).toEqual(false);
        expect(startsWith('haystack', 'hay')).toEqual(true);
        expect(startsWith('haystack', 'needle', false)).toEqual(false);
        expect(startsWith('haystack', 'hay', false)).toEqual(true);
        expect(startsWith('HaYstack', 'hAy', false)).toEqual(true);
    });

    it('endsWith works', () => {
        expect(endsWith('haystack', 'needle')).toEqual(false);
        expect(endsWith('haystack', 'stack')).toEqual(true);
        expect(endsWith('haystack', 'needle', false)).toEqual(false);
        expect(endsWith('haystack', 'stack', false)).toEqual(true);
        expect(endsWith('hatStacK', 'sTACk', false)).toEqual(true);
    });

    it('padLeft pads the left side of a string with a character', () => {
        expect(padLeft('foo', 6, '#')).toBe('###foo');
        expect(padLeft('foo', 2, '#')).toBe('foo');
        expect(padLeft('foo', 3, '#')).toBe('foo');
    });

    it('formatUrl properly applies template args and query params', () => {
        expect(formatUrl('http://example.com/{foo}')).toBe(
            'http://example.com/{foo}',
        );

        expect(formatUrl('http://example.com/{foo}', { foo: 'bar' })).toBe(
            'http://example.com/bar',
        );

        expect(
            formatUrl(
                'http://example.com/{foo}',
                { foo: 'b ar' },
                { param1: 'fo o' },
            ),
        ).toBe('http://example.com/b%20ar?param1=fo%20o');

        expect(
            formatUrl(
                'http://example.com/{foo}?baz=23',
                { foo: 'b ar' },
                { param1: 'fo o' },
            ),
        ).toBe('http://example.com/b%20ar?baz=23&param1=fo%20o');
    });
});
