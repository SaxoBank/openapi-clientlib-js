/*
 * This tests that the requirejs wrapper fundamentally works
 */

let iitOpenApi;

beforeAll((done) => {

	const loadRequireJS = new Promise((resolve) => {
		const requirejsScript = document.createElement('script');
		requirejsScript.onload = resolve;
		requirejsScript.src = '../libs/require.js';
		document.head.appendChild(requirejsScript);
	});

	const getVersion = fetch('../package.json')
		.then((packageJsonResponse) => packageJsonResponse.json())
		.then((packageObj) => {
			return packageObj.version;
		});
    Promise.all([getVersion, loadRequireJS])
		.then(function (promiseResults) {
		    const version = promiseResults[0];
		    requirejs([`../dist/release/openapi-client.js`], (lib) => {
		        iitOpenApi = lib;
		        done();
		    });
		})
});

describe("running with require", () => {
	it("loads iit", () => {
		expect(iitOpenApi).toEqual(jasmine.objectContaining({ utils: jasmine.anything(), openapi: jasmine.anything() }));
	});
});
