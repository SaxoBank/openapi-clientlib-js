/**
 * @module saxo/openapi/transport/options
 * @ignore
 */

import type { UseCloud } from './types';

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

function shouldUseCloud(serviceOptions?: UseCloud) {
    const { useCloud } = serviceOptions || {};

    return typeof useCloud === 'function' ? useCloud() : useCloud;
}

// -- Export section --

export { shouldUseCloud };
