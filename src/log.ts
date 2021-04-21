import MicroEmitter from './micro-emitter';

export interface ILogger {
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
    debug(...args: unknown[]): void;
}

/**
 * The shared js log, which allows posting messages and listening to them.
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
export class Log extends MicroEmitter implements ILogger {
    /**
     * The Debug event constant.
     */
    readonly DEBUG = 'debug';
    /**
     * The info event constant.
     */
    readonly INFO = 'info';
    /**
     * The warn event constant.
     */
    readonly WARN = 'warn';
    /**
     * the error event constant.
     */
    readonly ERROR = 'error';

    error = (...args: unknown[]) => this.trigger(this.ERROR, ...args);
    warn = (...args: unknown[]) => this.trigger(this.WARN, ...args);
    info = (...args: unknown[]) => this.trigger(this.INFO, ...args);
    debug = (...args: unknown[]) => this.trigger(this.DEBUG, ...args);
}

export default new Log();
