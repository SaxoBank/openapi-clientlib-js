function mockTransport() {
	function methodFunction(method) {
		return new Promise(function(resolve, reject) {
			transport[method + "Resolve"] = resolve;
			transport[method + "Reject"] = reject;
		});
	}

	var transport = jasmine.createSpyObj('transport', ['post', 'put', 'get', 'delete', 'patch', 'dispose']);
	transport.post.and.callFake(methodFunction.bind(null, "post"));
	transport.put.and.callFake(methodFunction.bind(null, "put"));
	transport.get.and.callFake(methodFunction.bind(null, "get"));
	transport.delete.and.callFake(methodFunction.bind(null, "delete"));
	transport.patch.and.callFake(methodFunction.bind(null, "patch"));

	return transport;
}

export default mockTransport;