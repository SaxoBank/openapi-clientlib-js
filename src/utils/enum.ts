import { extend } from './object';

type ObjectEnum<T extends string = string> = Record<T, boolean>;
export type Enum = string | ObjectEnum;

/**
 * Converts a comma separated strings or an array of strings to an object with each string being the property name.
 */
function toObject<T extends string = string, R extends string = T>(
    values: T | Array<T> | ObjectEnum<R>,
): ObjectEnum<R> {
    const obj = {} as ObjectEnum;

    if (Array.isArray(values)) {
        values.forEach((value) => {
            if (value) {
                obj[value] = true;
            }
        });
        return obj;
    }

    if (typeof values === 'string') {
        const valueList = values.split(',');
        valueList.forEach((value) => {
            const trimmedValue = value.trim();
            if (trimmedValue) {
                obj[trimmedValue] = true;
            }
        });

        return obj;
    }

    return values;
}

/**
 * Makes an enum definition.
 */
function makeDefinition<T extends string | number>(values: T[]): Record<T, T> {
    const enumDefinition = {} as Record<T, T>;

    values.forEach((value) => {
        enumDefinition[value] = value;
    });

    Object.freeze(enumDefinition);

    return enumDefinition;
}

/**
 * Produces the union of two enumerations.
 */
function union(enumA: Enum, enumB: Enum) {
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
function exclusion(enumA: Enum, enumB: Enum) {
    enumA = toObject(enumA);
    enumB = toObject(enumB);
    const enumResult: ObjectEnum = {};

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
 */
function toString(enumA: ObjectEnum) {
    const items = [];
    for (const key in enumA) {
        if (enumA.hasOwnProperty(key) && enumA[key]) {
            items.push(key);
        }
    }
    return items.join(', ');
}

export { toObject, makeDefinition, exclusion, union, toString };
