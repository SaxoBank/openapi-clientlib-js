function mockTransport() {
    const transport = {
        post: jest.fn(),
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        options: jest.fn(),
        dispose: jest.fn(),
        setUseXHttpMethodOverride: jest.fn(),
    };

    function methodFunction(method) {
        return new Promise(function (resolve, reject) {
            transport[method + 'Resolve'] = resolve;
            transport[method + 'Reject'] = reject;
        });
    }

    transport.post.mockImplementation(methodFunction.bind(null, 'post'));
    transport.put.mockImplementation(methodFunction.bind(null, 'put'));
    transport.get.mockImplementation(methodFunction.bind(null, 'get'));
    transport.delete.mockImplementation(methodFunction.bind(null, 'delete'));
    transport.patch.mockImplementation(methodFunction.bind(null, 'patch'));
    transport.options.mockImplementation(methodFunction.bind(null, 'options'));

    return transport;
}

export default mockTransport;
