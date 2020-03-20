/**
 * @module saxo/utils/object
 * @ignore
 */

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * @namespace saxo.utils.object
 */

/**
 * Extends an object with another, following the same syntax as `$.extend` - see {@link http://api.jquery.com/jquery.extend/}.
 * @alias saxo.utils.object.extend
 * @param {boolean} deep - If the argument list begins true the object will be deep copied.
 * @param {...object} objects - Merges properties from later objects on to the first object.
 * @static
 */
function extend() {
    // optimized extend
    // speed tested - http://jsperf.com/jquery-extend-vs-custom
    const deep = arguments[0] === true;
    const l = arguments.length;
    let i = deep ? 1 : 0;
    const result = arguments[i++] || {};
    let current;
    let val;

    for (; i < l; i++) {
        current = arguments[i];
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
}
// -- Export section --

export { extend };
