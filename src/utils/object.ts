import type { ExtendInterface } from './types';

type $Object = Record<string, any>;

/**
 * Extends an object with another, following the same syntax as `$.extend` - see {@link http://api.jquery.com/jquery.extend/}.
 * @alias saxo.utils.object.extend
 * @param {boolean} deep - If the argument list begins true the object will be deep copied.
 * @param {...object} objects - Merges properties from later objects on to the first object.
 */
const extend: ExtendInterface = (
    arg1: true | $Object | null,
    ...restArgs: Array<$Object | null>
) => {
    // optimized extend
    // speed tested - http://jsperf.com/jquery-extend-vs-custom
    const deep = arg1 === true;
    const l = restArgs.length;
    let i = 0;
    const result = ((deep ? restArgs[i++] : arg1) || {}) as $Object;
    let current: $Object;
    let val;

    for (; i < l; i++) {
        current = restArgs[i] as $Object;
        for (const prop in current) {
            if (current.hasOwnProperty(prop)) {
                val = current[prop];
                if (!deep || typeof val !== 'object') {
                    result[prop] = val;
                } else {
                    if (
                        typeof val !== typeof result[prop] ||
                        Array.isArray(val) !== Array.isArray(result[prop])
                    ) {
                        result[prop] = Array.isArray(val) ? [] : {};
                    }
                    extend(true, result[prop], val);
                }
            }
        }
    }
    return result;
};

export { extend };
