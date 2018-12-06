/*
 *  'OUTPUT_NAME' 'OUTPUT_VERSION'
 */
; (function (global) {
    "use strict";

    /*SPLIT PLACEHOLDER FOR ROLLUP*/

    // umd definition. First check if requirejs is running
    if (typeof define === "function" && define.amd) {
        define([], function () { return 'EXPORT_PLACEHOLDER'; });
    }
    else { // otherwise we expose globally

        // if the namespace exists, merge in the changes
        if (global["'NS_PLACEHOLDER'"]) {
            'EXPORT_PLACEHOLDER'.utils.object.extend(global["'NS_PLACEHOLDER'"], 'EXPORT_PLACEHOLDER');
        } else {
            global["'NS_PLACEHOLDER'"] = 'EXPORT_PLACEHOLDER';
        }
    }
}(this));
