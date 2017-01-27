const NumberFormatting = saxo.NumberFormatting;

function parse(number) {
	var numbers = new NumberFormatting();
	return numbers.parse(number);
}

describe("NumberFormatting parse", () => {
	it("basically works", () => {
		expect(parse("1.2")).toEqual(1.2);
		expect(parse("100,000")).toEqual(100000);
	});

	it("handles bad input", () => {
		expect(parse(null)).toEqual(NaN);
		expect(parse(undefined)).toEqual(NaN);
	});
});
