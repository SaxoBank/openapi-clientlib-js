import type { UseCloud, URLDetails } from './types';

function shouldUseCloud(serviceOptions?: UseCloud, urlDetails?: URLDetails) {
    const { useCloud } = serviceOptions || {};

    return typeof useCloud === 'function' ? useCloud(urlDetails) : useCloud;
}

export { shouldUseCloud };
