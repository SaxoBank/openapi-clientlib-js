import { multiline } from '../utils';

const batch = saxo.openapi.batch,
	batchBuild = batch.build,
	batchParse = batch.parse;

var testAuth = {token: "XYZ", expiry: new Date()};

describe("openapi batchUtil", () => {
	it("parses an empty response", () => {
		expect(batchParse("--X--")).toEqual([]);
	});

	it("parses a single response", () => {
		expect(batchParse(multiline(
			'--90f26034-d914-44a0-bd16-908fc535018d',
			'Content-Type: application/http; msgtype=response',
			'',
			'HTTP/1.1 201 Created',
			'Location: ',
			'X-Request-Id: 0',
			'Access-Control-Allow-Origin: http://computor.sys.dom',
			'Access-Control-Allow-Credentials: true',
			'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
			'Content-Type: application/json; charset=utf-8',
			'',
			'{ "mydata": {"Prop": 1}}',
			'--90f26034-d914-44a0-bd16-908fc535018d--',
			''
			))).toEqual([
				{status: 201, response: {"mydata": {"Prop": 1}}}
			]);
	});

	it("parses array data", () => {
		expect(batchParse(multiline(
			'--90f26034-d914-44a0-bd16-908fc535018d',
			'Content-Type: application/http; msgtype=response',
			'',
			'HTTP/1.1 201 Created',
			'Location: ',
			'X-Request-Id: 0',
			'Access-Control-Allow-Origin: http://computor.sys.dom',
			'Access-Control-Allow-Credentials: true',
			'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
			'Content-Type: application/json; charset=utf-8',
			'',
			'["mydata", "Prop"]',
			'--90f26034-d914-44a0-bd16-908fc535018d--',
			''
			))).toEqual([
				{status: 201, response: ["mydata", "Prop"]}
			]);
	});

	it("parses multiple responses", () => {
		expect(batchParse(multiline(
			'--90f26034-d914-44a0-bd16-908fc535018d',
			'Content-Type: application/http; msgtype=response',
			'',
			'HTTP/1.1 201 Created',
			'Location: ',
			'X-Request-Id: 0',
			'Access-Control-Allow-Origin: http://computor.sys.dom',
			'Access-Control-Allow-Credentials: true',
			'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
			'Content-Type: application/json; charset=utf-8',
			'',
			'{ "mydata": {"Prop": 1}}',
			'--90f26034-d914-44a0-bd16-908fc535018d',
			'Content-Type: application/http; msgtype=response',
			'',
			'HTTP/1.1 200 Ok',
			'Location: ',
			'X-Request-Id: 1',
			'Access-Control-Allow-Origin: http://computor.sys.dom',
			'Access-Control-Allow-Credentials: true',
			'Access-Control-Expose-Headers: X-Auth-Token,X-Auth-Token-Expiry,X-Auth-Token-Expiry-Minutes,X-Request-Id,WWW-Authenticate,Location,Content-Encoding,ETag,Content-Range',
			'Content-Type: application/json; charset=utf-8',
			'',
			'{ "second": 2 }',
			'--90f26034-d914-44a0-bd16-908fc535018d--',
			''
			))).toEqual([
				{status: 201, response: {"mydata": {"Prop": 1}}},
				{status: 200, response: {"second": 2}}
			]);
		});
	});

	describe("batch building", () => {

	it("handles no requests", () => {
		expect(batchBuild([], "X", testAuth, "iitbank.com"))
			.toEqual(multiline("--X--", ""));
	});

	it("handles one request", () => {
		expect(batchBuild(
				[{method: "GET", url: 'openapi/sub'}],
				"ABC", testAuth.token, "iitbank.com"))
			.toEqual(multiline(
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'GET openapi/sub HTTP/1.1',
				'X-Request-Id: 0',
				'Authorization: XYZ',
				'Host: iitbank.com',
				'',
				'', // extra new line is important
				'--ABC--',
				''));
	});

	it("puts headers into the batch", () => {
		expect(batchBuild(
				[{method: "GET", url: 'openapi/sub', headers: {"X-Auth-Request": "Me"}}],
				"ABC", testAuth.token, "iitbank.com"))
			.toEqual(multiline(
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'GET openapi/sub HTTP/1.1',
				'X-Request-Id: 0',
				'X-Auth-Request: Me',
				'Authorization: XYZ',
				'Host: iitbank.com',
				'',
				'',
				'--ABC--',
				''));
	});

	it("adds content-type for POST/PUT", () => {
		expect(batchBuild(
				[{method: "POST", data: "data", url: 'openapi/sub'}],
				"ABC", testAuth.token, "iitbank.com"))
			.toEqual(multiline(
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'POST openapi/sub HTTP/1.1',
				'X-Request-Id: 0',
				'Authorization: XYZ',
				'Content-Type: application/json; charset=utf-8',
				'Host: iitbank.com',
				'',
				'data',
				'--ABC--',
				''));

		expect(batchBuild(
				[{method: "PUT", data: "data", url: 'openapi/sub'}],
				"ABC", testAuth.token, "iitbank.com"))
			.toEqual(multiline(
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'PUT openapi/sub HTTP/1.1',
				'X-Request-Id: 0',
				'Authorization: XYZ',
				'Content-Type: application/json; charset=utf-8',
				'Host: iitbank.com',
				'',
				'data',
				'--ABC--',
				''));
	});

	it("handles multiple requests", () => {
		expect(batchBuild(
				[{method: "POST", data: "postdata", url: 'openapi/sub'},
				{method: "PUT", data: "putdata", url: 'openapi/bus'},
				{method: "GET", url: 'openapi/usb'}],
				"ABC", testAuth.token, "iitbank.com"))
			.toEqual(multiline(
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'POST openapi/sub HTTP/1.1',
				'X-Request-Id: 0',
				'Authorization: XYZ',
				'Content-Type: application/json; charset=utf-8',
				'Host: iitbank.com',
				'',
				'postdata',
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'PUT openapi/bus HTTP/1.1',
				'X-Request-Id: 1',
				'Authorization: XYZ',
				'Content-Type: application/json; charset=utf-8',
				'Host: iitbank.com',
				'',
				'putdata',
				'--ABC',
				'Content-Type: application/http; msgtype=request',
				'',
				'GET openapi/usb HTTP/1.1',
				'X-Request-Id: 2',
				'Authorization: XYZ',
				'Host: iitbank.com',
				'',
				'',
				'--ABC--',
				''));
	});
});
