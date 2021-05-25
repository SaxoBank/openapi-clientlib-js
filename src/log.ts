import MicroEmitter from './micro-emitter';

const ERROR = 'error';
const WARN = 'warn';
const INFO = 'info';
const DEBUG = 'debug';

type EventNames = typeof ERROR | typeof WARN | typeof INFO | typeof DEBUG;

type EmittedEvents = {
    [name in EventNames]: (
        logArea: string,
        message: string,
        context?: Record<string, any>,
        options?: Record<string, any>,
    ) => void;
};

type LogParams = Parameters<EmittedEvents[typeof ERROR]>;

/**
 * The shared js log, which allows posting messages and listening to them.
 * @example
 * // to log
 * ```ts
 * log.warn("Area", "Warning... such and so...", { data: context});
 * ```
 * // to listen to all logs on the console
 *
 * ```ts
 * log.on(log.DEBUG, console.debug.bind(console));
 * log.on(log.INFO, console.info.bind(console));
 * log.on(log.WARN, console.info.bind(console));
 * log.on(log.ERROR, console.error.bind(console));
 * ```
 */
export class Log extends MicroEmitter<EmittedEvents> {
    /**
     * The Debug event constant.
     */
    readonly DEBUG = DEBUG;
    /**
     * The info event constant.
     */
    readonly INFO = INFO;
    /**
     * The warn event constant.
     */
    readonly WARN = WARN;
    /**
     * the error event constant.
     */
    readonly ERROR = ERROR;

    constructor() {
        super();
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);
    }

    /**
     * @param area - The area of the code e.g. "Streaming" or "TransportBatch".
     * @param message - The error message e.g. "Something has gone wrong".
     * @param context - (optional) Data associated with the event.
     * @param options - (optional) Options object
     */
    error(...args: LogParams) {
        return this.trigger(this.ERROR, ...args);
    }

    /**
     * @param area - The area of the code e.g. "Streaming" or "TransportBatch".
     * @param message - The error message e.g. "Something has gone wrong".
     * @param context - (optional) Data associated with the event.
     * @param options - (optional) Options object
     */
    warn(...args: LogParams) {
        return this.trigger(this.WARN, ...args);
    }

    /**
     * @param area - The area of the code e.g. "Streaming" or "TransportBatch".
     * @param message - The error message e.g. "Something has gone wrong".
     * @param context - (optional) Data associated with the event.
     * @param options - (optional) Options object
     */
    info(...args: LogParams) {
        return this.trigger(this.INFO, ...args);
    }

    /**
     * @param area - The area of the code e.g. "Streaming" or "TransportBatch".
     * @param message - The error message e.g. "Something has gone wrong".
     * @param context - (optional) Data associated with the event.
     * @param options - (optional) Options object
     */
    debug(...args: LogParams) {
        return this.trigger(this.DEBUG, ...args);
    }
}

export default new Log();
