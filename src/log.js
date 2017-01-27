/**
 * The Shared JS Log. use it to log or listen to log messages.
 * Use the {@link MicroEmitter} mixed into log to listen for log messages.
 * When using namespaces, access with `saxo.log`.
 * @module saxo/log
 * @ignore
 */

import emitter from './micro-emitter';

//-- Local variables section --

//-- Local methods section --

//-- Exported methods section --

/**
 * The shared js log, which allows posting messages and listening to them.
 * @namespace saxo.log
 * @mixes MicroEmitter
 * @example
 * // to log
 * log.warn("Area", "Warning... such and so...", { data: context});
 *
 * // to listen to all logs on the console
 * log.on(log.DEBUG, console.debug.bind(console));
 * log.on(log.INFO, console.info.bind(console));
 * log.on(log.WARN, console.info.bind(console));
 * log.on(log.ERROR, console.error.bind(console));
 */
var log = {};

/**
 * The Debug event constant.
 * @alias saxo.log.DEBUG
 */

log.DEBUG = "debug";
/**
 * The info event constant.
 * @alias saxo.log.INFO
 */
log.INFO = "info";

/**
 * The warn event constant.
 * @alias saxo.log.WARN
 */
log.WARN = "warn";

/**
 * the error event constant.
 * @alias saxo.log.ERROR
 */
log.ERROR = "error";

emitter.mixinTo(log);

/**
 * @function
 * @alias saxo.log.debug
 * @param {string} area - The area of the code e.g. "Streaming" or "TransportBatch".
 * @param {string} message - The error message e.g. "Something has gone wrong".
 * @param {Object|string} [data] - Data associated with the event.
 */
log.debug = log.trigger.bind(log, log.DEBUG);

/**
 * @function
 * @alias saxo.log.info
 * @param {string} area - The area of the code e.g. "Streaming" or "TransportBatch".
 * @param {string} message - The error message e.g. "Something has gone wrong".
 * @param {Object|string} [data] - Data associated with the event.
 */
log.info = log.trigger.bind(log, log.INFO);

/**
 * @function
 * @alias saxo.log.warn
 * @param {string} area - The area of the code e.g. "Streaming" or "TransportBatch".
 * @param {string} message - The error message e.g. "Something has gone wrong".
 * @param {Object|string} [data] - Data associated with the event.
 */
log.warn = log.trigger.bind(log, log.WARN);

/**
 * @function
 * @alias saxo.log.error
 * @param {string} area - The area of the code e.g. "Streaming" or "TransportBatch".
 * @param {string} message - The error message e.g. "Something has gone wrong".
 * @param {Object|string} [data] - Data associated with the event.
 */
log.error = log.trigger.bind(log, log.ERROR);

//-- Export section --

export default log;
