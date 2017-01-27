const extend = saxo.utils.object.extend;

describe("utils object", () => {
	describe("extend", () => {
		it("basically functions in shallow mode", () => {
			expect(extend({},{banana: true}))
				.toEqual({banana: true});
			expect(extend({apple: false},{banana: true}))
				.toEqual({apple: false, banana: true});
			expect(extend({apple: false, banana: true},{banana: false}))
				.toEqual({apple: false, banana: false});
		});
		it("copes with multiple arguments in shallow mode", () => {
			expect(extend({},{banana: true}, {apple: true}))
				.toEqual({banana: true, apple: true});
			expect(extend({apple: true, banana: true}, {apple: false}, {banana: false}))
				.toEqual({apple: false, banana: false});
			expect(extend({fruit: { apple: true, banana: true}}, {fruit: {}}))
				.toEqual({fruit: {}});
		});
		it("allows null as a first argument to mean create a new object", () => {
			expect(extend(null, {banana: true}, {apple: true}))
				.toEqual({banana: true, apple: true});
		});
		describe("deep mode", () => {
			it("works without deep objects", () => {
				expect(extend(true, {}, {banana: true}, {apple: true}))
					.toEqual({banana: true, apple: true});
			});
			it("works with multiple deep objects", () => {
				expect(extend(true, {}, {fruit: { apple: true, banana: true}}, {fruit: {banana: false}}))
					.toEqual({fruit: { apple: true, banana: false}});
				expect(extend(true, {fruit: {}}, {fruit: { apple: true, banana: true}}, {fruit: {banana: false}}))
					.toEqual({fruit: { apple: true, banana: false}});
			});
			it("overrides a shallow object with a deep one and vice-versa", () => {
				expect(extend(true, {fruit: { apple: true, banana: true}}, {fruit: true}))
					.toEqual({fruit: true});
				expect(extend(true, {fruit: true}, {fruit: { apple: true, banana: true}}))
					.toEqual({fruit: { apple: true, banana: true}});
			});
			it("allows null as a first argument to mean create a new object", () => {
				expect(extend(true, null, {banana: true}, {apple: true}))
					.toEqual({banana: true, apple: true});
			});
			it("does not alter the original of a deep object not at the first position", () => {
				var immutable = {fruit:{}};
				extend(true, {}, immutable, {fruit:{bananas: true}});
				expect(immutable.fruit)
					.toEqual({});
			});
			it("does not merge arrays", () => {
				expect(extend(true, {fruit: ["apple", "banana"]}, {fruit: {apple: true}}))
					.toEqual({fruit: {apple: true}});
				expect(extend(true, {fruit: {apple: true}}, {fruit: ["apple", "banana"]}))
					.toEqual({fruit: ["apple", "banana"]});
			});
		});
	});
});
