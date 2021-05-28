/**
 * @module saxo/utils/enum
 * @ignore
 */

import { extend } from './object';

// -- Local variables section --

// -- Local methods section --

// -- Exported methods section --

/**
 * @namespace saxo.utils.enum
 */

/**
 * Converts from a comma separated object or an array of strings to an object with each string being the property name.
 * @alias saxo.utils.enum.toObject
 * @param {Array.<string>|string|Object} values
 * @returns {Object}
 * @example
 * var enumUtils = require("saxo/utils/enum");    // AMD
 * var enumUtils = saxo.utils.enum;                // Namespaces
 * var obj = enumUtils.toObject("DeciPips,Percentage");
 * if (obj.DeciPips) {
 *     assert("We should reach here");
 * }
 * var otherFormats = enumUtils.toObject(["DeciPips", "Percentage"]);
 */
function toObject(values) {
    if (Array.isArray(values)) {
        const obj = {};
        for (let i = 0, l = values.length; i < l; i++) {
            const value = values[i];
            if (value) {
                obj[value] = true;
            }
        }
        return obj;
    }
    if (typeof values !== 'string') {
        return values;
    }
    const obj = {};
    const valueList = values.split(',');
    for (let i = 0, l = valueList.length; i < l; i++) {
        const value = valueList[i].trim();
        if (value) {
            obj[value] = true;
        }
    }
    return obj;
}

/**
 * Makes an enum definition.
 * @alias saxo.utils.enum.makeDefinition
 * @param {Array} values
 * @returns {Object}
 * @example
 * var enum = enumUtils.makeDefinition(["Percentage", "DeciPips"]);
 * // enum =
 * //     {
 * //     "Percentage": "Percentage",
 * //     "DeciPips": "DeciPips"
 * //     }
 */
function makeDefinition(values) {
    const enumDefinition = {};

    for (let i = 0, l = values.length; i < l; i++) {
        enumDefinition[values[i]] = values[i];
    }

    Object.freeze(enumDefinition);

    return enumDefinition;
}

/**
 * Produces the union of two enumerations.
 * @param {Array.<string>|string|Object} enumA
 * @param {Array.<string>|string|Object} enumB
 * @returns {Object}
 * @example
 * var enum = enumUtils.union("Percentage", { DeciPips: true });
 * // enum == { Percentage: true, DeciPips: true }
 */
function union(enumA, enumB) {
    enumA = toObject(enumA);
    enumB = toObject(enumB);
    return extend({}, enumA, enumB);
}

/**
 * Returns an enumeration of items in enumA that are not in enumB.
 * @param {Array.<string>|string|Object} enumA
 * @param {Array.<string>|string|Object} enumB
 * @returns {Object}
 * @example
 * var enum = enumUtils.union("Percentage,DeciPips", { DeciPips: true });
 * // enum == { Percentage: true }
 */
function exclusion(enumA, enumB) {
    enumA = toObject(enumA);
    enumB = toObject(enumB);
    const enumResult = {};

    for (const value in enumA) {
        if (
            enumA.hasOwnProperty(value) &&
            enumA[value] &&
            (!enumB.hasOwnProperty(value) || !enumB[value])
        ) {
            enumResult[value] = true;
        }
    }
    return enumResult;
}

/**
 * Converts an object representation of an enumeration to a string
 * @param {Object} enumA
 * @returns {String}
 * @example
 * var str = enumUtils.union({ DeciPips: true, Percentage: true });
 * // str == "DeciPips, Percentage"
 */
function toString(enumA) {
    const items = [];
    for (const key in enumA) {
        if (enumA.hasOwnProperty(key) && enumA[key]) {
            items.push(key);
        }
    }
    return items.join(', ');
}

// -- Export section --

export { toObject, makeDefinition, exclusion, union, toString };
