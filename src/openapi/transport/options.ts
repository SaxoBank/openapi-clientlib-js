import type { UseCloud } from './types';

function shouldUseCloud(serviceOptions?: UseCloud) {
    const { useCloud } = serviceOptions || {};

    return typeof useCloud === 'function' ? useCloud() : useCloud;
}

export { shouldUseCloud };
