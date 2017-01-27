import mockFetch from '../../mocks/fetch';
import { tick, installClock, uninstallClock } from '../../utils';
var transport;
var fetch;

const TransportCore = saxo.openapi.TransportCore,
	Streaming = saxo.openapi.Streaming;

describe("openapi TransportCore", () => {
	beforeEach(() => {
		fetch = mockFetch();
	});

	describe("parameters", () => {
		it("requires a service group and url", () => {
			transport = new TransportCore('localhost/openapi');
			expect(() => transport.get()).toThrow();
			expect(() => transport.get("", "")).toThrow();
			expect(() => transport.get("service_group", "")).toThrow();
			expect(() => transport.get("", "url")).toThrow();

			expect(() => new TransportCore()).toThrow();
			expect(() => new TransportCore(null, {})).toThrow();
			expect(() => new TransportCore('')).toThrow();
		});
	});

	describe("url templating", () => {
		it("basically works", () => {
			transport = new TransportCore('localhost/openapi');
			transport.get("service_group", "account/info/{user}/{account}", { user: "te", account: "st" });

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info/te/st", jasmine.anything()]);
			fetch.calls.reset();

			transport.get("service_group", "account/info/{user}?acc={account}&thingy={thing}", { user: "te", account: "st", thing: "ing" });
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info/te?acc=st&thingy=ing", jasmine.anything()]);
			fetch.calls.reset();
		});

		it("includes multiple query params", () => {
			transport = new TransportCore('localhost/openapi');
			transport.get("service_group", "account/info", null, { queryParams: { a: 1, b: 2 }});

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info?a=1&b=2", jasmine.anything()]);
			fetch.calls.reset();
		});

		it("allows query params option and query params in the template", () => {
			transport = new TransportCore('localhost/openapi');
			transport.get("service_group", "account/info?a=1&b=2", null, { queryParams: { c: 3, d: 4 }});

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info?a=1&b=2&c=3&d=4", jasmine.anything()]);
			fetch.calls.reset();
		});

		it("url encodes template args", () => {
			transport = new TransportCore('localhost/openapi');
			transport.get("service_group", "account/info/{user}/{account}", { user: "te ?=!/\\", account: String.fromCharCode(160) });

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info/te%20%3F%3D!%2F%5C/%C2%A0", jasmine.anything()]);
			fetch.calls.reset();
		});

		it("url encodes queryParams", () => {
			transport = new TransportCore('localhost/openapi');
			transport.get("service_group", "account/info", null, { queryParams: { a: "&=" }});

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info?a=%26%3D", jasmine.anything()]);
			fetch.calls.reset();
		});

	});

	describe("response code", () => {
		beforeEach(() => {
			installClock();
		});
		afterEach(function() {
			uninstallClock();
		});
		it("rejects a 400 response", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(400, "Error");

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.catch(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);
				done();
			});
		});
		it("resolves a 200 response", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(200, "Text");

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.then(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);
				done();
			});
		});
		it("resolves a 304 response", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(304, "Text");

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.then(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);
				done();
			});
		});
	});

	describe("request body", () => {
		it("allows an object", () => {
			transport = new TransportCore('localhost/openapi');
			transport.post("service_group", "account/info/{user}/{account}", {user: "te", account: "st"}, { body: {Test: true}});

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info/te/st",
				{ body: '{"Test":true}', method: "POST", headers: {"Content-Type": 'application/json; charset=UTF-8'},
				// credentials: 'include' adds cookies.
				// Cookies used by some open api operations. if we don't default here make sure it is sent through with subscription requests.
				credentials: 'include' }]);
		});
		it("allows an string", () => {
			transport = new TransportCore('localhost/openapi');
			transport.post("service_group", "account/info/{user}/{account}", {user: "te", account: "st"}, { body: '{"Test":true}'});

			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual(["localhost/openapi/service_group/account/info/te/st", { body: '{"Test":true}', method: "POST", headers: {}, credentials: 'include'}]);
		});
	});

	describe("response data", () => {
		beforeEach(() => {
			installClock();
		});

		afterEach(function() {
			uninstallClock();
		});

		it("gets text from a multipart/mixed", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(200, "Text", "multipart/mixed");

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.then(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);

				var res = getSpy.calls.argsFor(0)[0];
				expect(res).toEqual(jasmine.objectContaining({ status: 200, response: "Text" }));
				done();
			});
		});

		it("parses a json response", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(200, { Test: true });

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.then(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);

				var res = getSpy.calls.argsFor(0)[0];
				expect(res).toEqual(jasmine.objectContaining({ status: 200, response: { Test: true } }));
				expect(res.headers.get("content-type")).toEqual("application/json; utf-8");
				done();
			});
		});

		it("parses a json response when a call fails", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.reject(200, { Test: true });

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.catch(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);

				var res = getSpy.calls.argsFor(0)[0];
				expect(res).toEqual(jasmine.objectContaining({ status: 200, response: { Test: true } }));
				expect(res.headers.get("content-type")).toEqual("application/json; utf-8");
				done();
			});
		});

		it("copes with an exception reject", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.reject(new Error('no properties'));

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.catch(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);
				done();
			});
		});

		it("parses a json response when a call is resolved, but failed due to response status", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(400, { Test: true });

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.catch(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);

				var res = getSpy.calls.argsFor(0)[0];
				expect(res).toEqual(jasmine.objectContaining({ status: 400, response: { Test: true } }));
				expect(res.headers.get("content-type")).toEqual("application/json; utf-8");
				done();
			});
		});

		it("copes with invalid json", (done) => {
			transport = new TransportCore('localhost/openapi');
			var getPromise = transport.get("service_group", "account/info", null);

			fetch.resolve(200, '{ "test": ', "application/json; utf-8");

			var getSpy = jasmine.createSpy("getSpy");
			getPromise.then(getSpy);

			tick(() => {
				expect(getSpy.calls.count()).toEqual(1);

				var res = getSpy.calls.argsFor(0)[0];
				expect(res).toEqual(jasmine.objectContaining({ status: 200, response: '{ "test": ' }));
				expect(res.headers.get("content-type")).toEqual("application/json; utf-8");
				done();
			});
		});
	});

	describe("cache", () => {
		function expectItWasAllowingCaching() {
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual([jasmine.stringMatching(/url$/), jasmine.anything()]);
		}
		function expectItWasNotAllowingCaching() {
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual([jasmine.stringMatching(/url\?_=\d+$/), jasmine.anything()]);
		}
		it("defaults to true and can be overridden globally and at each call", () => {
			transport = new TransportCore('localhost/openapi');
			expect(transport.defaultCache).toEqual(true);

			transport.get("service_group", "url", null, {});
			expectItWasAllowingCaching();
			fetch.calls.reset();

			transport.get("service_group", "url", null, { cache: false });
			expectItWasNotAllowingCaching();
			fetch.calls.reset();

			transport.get("service_group", "url", null, { cache: true });
			expectItWasAllowingCaching();
			fetch.calls.reset();

			transport = new TransportCore('localhost/openapi', { defaultCache: false });
			expect(transport.defaultCache).toEqual(false);

			transport.get("service_group", "url", null, {});
			expectItWasNotAllowingCaching();
			fetch.calls.reset();

			transport.get("service_group", "url", null, { cache: false });
			expectItWasNotAllowingCaching();
			fetch.calls.reset();

			// test state has not changed
			transport.get("service_group", "url", null, { cache: true });
			expectItWasAllowingCaching();
			fetch.calls.reset();

			transport = new TransportCore('localhost/openapi', { defaultCache: true});
			expect(transport.defaultCache).toEqual(true);

			transport.get("service_group", "url", null, {});
			expectItWasAllowingCaching();
			fetch.calls.reset();

			transport.get("service_group", "url", null, { cache: false });
			expectItWasNotAllowingCaching();
			fetch.calls.reset();

			// test state has not changed
			transport.get("service_group", "url", null, { cache: true });
			expectItWasAllowingCaching();
			fetch.calls.reset();
		});

		it("copes with a url that already has a param", () => {
			transport = new TransportCore('localhost/openapi');
			expect(transport.defaultCache).toEqual(true);

			transport.get("service_group", "url?param=true", null, { cache: false });
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual([jasmine.stringMatching(/url\?param=true&_=\d+$/), jasmine.anything()]);
		});
	});

	describe("language", () => {

		beforeEach(() => {
			transport = new TransportCore('localhost/openapi', { language:"dk"});
		});
		afterEach(() => transport.dispose());

		function expectTheLanguageToBeSetTo(assertedLanguage) {
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0)).toEqual([jasmine.anything(), jasmine.objectContaining({headers: jasmine.objectContaining({ Language: assertedLanguage})})]);
		}

		it("adds on the language", () => {

			transport.get("service_group", "url", null, {});
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();

			transport.put("service_group", "url", null, null);
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();

			transport.post("service_group", "url", null, { headers: null });
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();

			transport.delete("service_group", "url", null, { headers: {} });
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();

			transport.patch("service_group", "url");
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();
		});

		it("does not override a custom language", () => {

			transport.get("service_group", "url", {}, { headers: {Language:"en"}});
			expectTheLanguageToBeSetTo("en");
			fetch.calls.reset();

			transport.put("service_group", "url", {}, { headers: {Language:"dk"}});
			expectTheLanguageToBeSetTo("dk");
			fetch.calls.reset();

			transport.post("service_group", "url", {}, { headers: {Language:"sv"}});
			expectTheLanguageToBeSetTo("sv");
			fetch.calls.reset();

			transport.delete("service_group", "url", {}, { headers: {Language:"en"}});
			expectTheLanguageToBeSetTo("en");
			fetch.calls.reset();

			transport.patch("service_group", "url", {}, { headers: {otherHeader: "yes", Language:"en"}});
			expectTheLanguageToBeSetTo("en");
			fetch.calls.reset();
		});
	});

	describe("setUseXHttpMethodOverride", () => {

		beforeEach(() => {
			transport = new TransportCore('localhost/openapi');
			transport.setUseXHttpMethodOverride(true);
		});

		afterEach(() => transport.dispose());

		it("works", () => {

			transport.get("service_group", "url", null, {});
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0))
				.toEqual([jasmine.anything(),
					jasmine.objectContaining({
						method: "GET",
						headers: {}})]);
			fetch.calls.reset();

			transport.put("service_group", "url", null, null);
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0))
				.toEqual([jasmine.anything(),
					jasmine.objectContaining({
						method: "POST",
						headers: {
							"X-HTTP-Method-Override": "PUT"
						}})]);
			fetch.calls.reset();

			transport.post("service_group", "url", null, { headers: null });
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0))
				.toEqual([jasmine.anything(),
					jasmine.objectContaining({
						method: "POST",
						headers: {}})]);
			fetch.calls.reset();

			transport.delete("service_group", "url", null, { headers: {} });
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0))
				.toEqual([jasmine.anything(),
					jasmine.objectContaining({
						method: "POST",
						headers: {
							"X-HTTP-Method-Override": "DELETE"
						}})]);
			fetch.calls.reset();

			transport.patch("service_group", "url");
			expect(fetch.calls.count()).toEqual(1);
			expect(fetch.calls.argsFor(0))
				.toEqual([jasmine.anything(),
					jasmine.objectContaining({
						method: "POST",
						headers: {
							"X-HTTP-Method-Override": "PATCH"
						}})]);
			fetch.calls.reset();
		});
	});
});
