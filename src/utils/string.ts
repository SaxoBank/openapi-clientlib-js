/**
 * @module saxo/utils/string
 * @ignore
 */

// -- Local variables section --

const formatRx = /\{([^{]+?)\}/g;

// -- Local methods section --

// -- Exported methods section --

/**
 * @namespace saxo.utils.string
 */

/**
 * Formats text with arguments.
 * @alias saxo.utils.string.format
 * @param {string} sTemplate
 * @param {(Object|...string)} args - Accepts either an object with keys or the arguments will be indexed.
 * @returns {string}
 */
function format(sTemplate, args) {
    if (typeof args !== 'object') {
        args = Array.prototype.slice.call(arguments, 1);
    }
    return sTemplate.replace(formatRx, function (capture, p1) {
        return args[p1] === undefined ? '{' + p1 + '}' : args[p1];
    });
}

/**
 * Returns true if the string starts with the needle.
 * @alias saxo.utils.string.startsWith
 * @param {string} haystack
 * @param {string} needle
 * @param {boolean} [isCaseSensitive=true] - Whether it is case sensitive. Use false to make insensitive.
 * @returns {boolean}
 */
function startsWith(haystack, needle, isCaseSensitive) {
    if (isCaseSensitive === false) {
        haystack = haystack.toLowerCase();
        needle = needle.toLowerCase();
    }
    return haystack.lastIndexOf(needle, 0) === 0;
}

/**
 * Returns true if the string ends with the needle.
 * @alias saxo.utils.string.endsWith
 * @param {string} haystack
 * @param {string} needle
 * @param {boolean} [isCaseSensitive=true] - Whether it is case sensitive. Use false to make insensitive.
 * @returns {boolean}
 */
function endsWith(haystack, needle, isCaseSensitive) {
    if (isCaseSensitive === false) {
        haystack = haystack.toLowerCase();
        needle = needle.toLowerCase();
    }
    return haystack.lastIndexOf(needle) === haystack.length - needle.length;
}

/**
 * Creates a new string that has the input string in a number of times
 * @param {string} s - The string to repeat
 * @param {number} count - The number of times to repeat
 * @example
 * var out = multiply("*", 2);
 * // out === "**"
 */
function multiply(s, count) {
    let res = '';
    for (let i = 0; i < count; i++) {
        res += s;
    }
    return res;
}

/**
 * Pads the left side of a string with a character
 * @param {string} value - The string to pad
 * @param {number} length - The required output length
 * @param {string} padChar - The character to use for padding
 * @example
 * var out = padLeft("1", 3, "0");
 * // out === "001"
 */
function padLeft(value, length, padChar) {
    if (length <= value.length) {
        return value;
    }

    return multiply(padChar, length - value.length) + value;
}

/**
 * Formats text with arguments for a URL. All data arguments are uri encoded.
 * @alias saxo.utils.string.formatUrl
 * @param {string} urlTemplate
 * @param {(Object|...string)} templateArgs - Accepts either an object with keys or the arguments will be indexed.
 * @param {Object} [queryParams] - query params as an object that will be added to the URL e.g. {a:1} => ?a=1
 * @returns {string}
 */
function formatUrl(urlTemplate, templateArgs, queryParams) {
    let url;

    if (templateArgs) {
        const urlEncodedTemplateArgs = {};
        for (const arg in templateArgs) {
            if (templateArgs.hasOwnProperty(arg)) {
                urlEncodedTemplateArgs[arg] = encodeURIComponent(
                    templateArgs[arg],
                );
            }
        }
        url = format(urlTemplate, urlEncodedTemplateArgs);
    } else {
        url = urlTemplate;
    }

    if (queryParams) {
        let firstQueryParam = url.indexOf('?') < 0;
        for (const queryParamKey in queryParams) {
            if (
                queryParams.hasOwnProperty(queryParamKey) &&
                queryParams[queryParamKey] != null
            ) {
                url +=
                    (firstQueryParam ? '?' : '&') +
                    queryParamKey +
                    '=' +
                    encodeURIComponent(queryParams[queryParamKey]);
                firstQueryParam = false;
            }
        }
    }

    return url;
}

// -- Export section --

export { format, formatUrl, startsWith, endsWith, multiply, padLeft };
