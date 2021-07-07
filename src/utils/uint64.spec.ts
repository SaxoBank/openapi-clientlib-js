import * as unint64 from './uint64';

describe('uint64', () => {
    it('converts 1', () => {
        const buf = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]);
        expect(unint64.uint64ToNumber(buf)).toMatchInlineSnapshot(`1`);
    });
    it('converts 256', () => {
        const buf = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0]);
        expect(unint64.uint64ToNumber(buf)).toMatchInlineSnapshot(`256`);
    });
    it('converts a large number', () => {
        const buf = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0]);
        expect(unint64.uint64ToNumber(buf)).toMatchInlineSnapshot(`4294967296`);
    });
    it('converts a large number plus 1', () => {
        const buf = new Uint8Array([1, 0, 0, 0, 1, 0, 0, 0]);
        expect(unint64.uint64ToNumber(buf)).toMatchInlineSnapshot(`4294967297`);
    });
});
