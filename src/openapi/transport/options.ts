/**
 * @module saxo/openapi/transport/options
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

function shouldUseCloud(serviceOptions) {
    const { useCloud } = serviceOptions || {};

    return typeof useCloud === 'function' ? useCloud() : useCloud;
}

// -- Export section --

export { shouldUseCloud };
