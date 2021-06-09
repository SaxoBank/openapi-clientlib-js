import log from '../../log';
import type AuthProvider from '../authProvider';
import TransportCore from './core';
import TransportBase from './transport-base';
import type { TransportOptions } from './types';
import type {
    OAPIRequestResult,
    HTTPMethodType,
    NetworkError,
    StringTemplateArgs,
    RequestOptions,
} from '../../types';

const LOG_AREA = 'TransportAuth';

// The default period within which errors on different tokens
// cause an endpoint auth errors to be ignored.
const DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD = 30000; // ms

/**
 * This class builds on top of {@link TransportCore} and adds authentication management. You need only
 * construct one or the other, they automatically wrap each other. All of the options from the {@link TransportCore}
 * constructor are valid here as well.
 * For authentication management, this class will wait until just before the authentication expires (see tokenRefreshMarginMs)
 * and will refresh the token generating an event which is picked up by some of the other Transports.
 *
 * @param baseUrl - The base url used for all open api requests. This should be an absolute URL.
 * @param authProvider - a AuthProvider to get the token from
 * @param options - (optional) Options for auth and for the core transport. See Transport.
 */
class TransportAuth extends TransportBase {
    authErrorsDebouncePeriod = DEFAULT_AUTH_ERRORS_DEBOUNCE_PERIOD;
    authorizationErrors: Record<
        string,
        Array<{ authExpiry: number; added: number }>
    > = {};

    // needs to map with transport core interface
    transport: TransportCore;
    authProvider: AuthProvider;

    constructor(
        baseUrl: string,
        authProvider: AuthProvider,
        options?: TransportOptions,
    ) {
        super();
        if (!authProvider) {
            throw new Error('transport auth created without a auth provider');
        }

        if (options?.authErrorsDebouncePeriod) {
            this.authErrorsDebouncePeriod = options.authErrorsDebouncePeriod;
        }

        this.transport = new TransportCore(baseUrl, options);

        // Map of authorization error counts per endpoint/url.
        this.authProvider = authProvider;
    }

    private onTransportError(
        oldTokenExpiry: number,
        timeRequested: number,
        result: OAPIRequestResult | NetworkError,
    ): never {
        if (result?.status === 401) {
            this.addAuthError(result.url, oldTokenExpiry, timeRequested);
            this.cleanupAuthErrors();
            const areUrlAuthErrorsProblematic =
                this.areUrlAuthErrorsProblematic(result.url, oldTokenExpiry);

            if (areUrlAuthErrorsProblematic) {
                // Blocking infinite loop of authorization re-requests which might be caused by invalid
                // behavior of given endpoint which constantly returns 401 error.
                log.error(
                    LOG_AREA,
                    'Too many authorization errors occurred for different tokens within a specified time-frame for a specific endpoint',
                    { url: result.url },
                );
                throw {
                    message: 'Auth overload',
                    isNetworkError: false,
                };
            }

            log.debug(LOG_AREA, 'Authentication failure', result);

            this.authProvider.tokenRejected(oldTokenExpiry);
        }
        throw result;
    }

    prepareTransportMethod(method: HTTPMethodType) {
        return (
            servicePath: string,
            urlTemplate: string,
            templateArgs?: StringTemplateArgs,
            options?: RequestOptions,
        ): Promise<OAPIRequestResult> => {
            const newOptions = {
                ...options,
                headers: {
                    ...(options && options.headers),
                    Authorization: this.authProvider.getToken() as string,
                },
            };

            return this.transport[method](
                servicePath,
                urlTemplate,
                templateArgs,
                newOptions,
            ).catch(
                // binding of this is required to access the old context for getting old expiry token
                // see ath.spec.js refreshes the token when a transport call returns a 401
                this.onTransportError.bind(
                    this,
                    this.authProvider.getExpiry(),
                    Date.now(),
                ),
            );
        };
    }

    // Cleanup of error counter map
    cleanupAuthErrors() {
        const cleanThoseBefore = Date.now() - this.authErrorsDebouncePeriod;

        for (const url in this.authorizationErrors) {
            if (this.authorizationErrors.hasOwnProperty(url)) {
                const newEntries = [];
                for (let i = 0; i < this.authorizationErrors[url].length; i++) {
                    if (
                        this.authorizationErrors[url][i].added >
                        cleanThoseBefore
                    ) {
                        newEntries.push(this.authorizationErrors[url][i]);
                    }
                }
                if (newEntries.length) {
                    this.authorizationErrors[url] = newEntries;
                } else {
                    delete this.authorizationErrors[url];
                }
            }
        }
    }

    /**
     * Add a authentication error to the error map
     * @param url - The url/endpoint at which a auth error occurred
     * @param authExpiry - The expiry of the token that was rejected
     * @param timeRequested - The time the request was made
     */
    addAuthError(url: string, authExpiry: number, timeRequested: number) {
        if (this.authorizationErrors.hasOwnProperty(url)) {
            this.authorizationErrors[url].push({
                authExpiry,
                added: timeRequested,
            });
        } else {
            this.authorizationErrors[url] = [
                { authExpiry, added: timeRequested },
            ];
        }
    }

    /**
     * Returns if the auth errors for a url are problematic
     * @param url - The url/endpoint to check
     * @param authExpiry - The auth expiry of the request to check
     * @returns  Whether it is problematic
     */
    areUrlAuthErrorsProblematic(url: string, authExpiry: number) {
        if (this.authorizationErrors.hasOwnProperty(url)) {
            for (let i = 0; i < this.authorizationErrors[url].length; i++) {
                if (
                    this.authorizationErrors[url][i].authExpiry !== authExpiry
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    //  Stops the transport from refreshing the token.
    dispose() {
        this.authorizationErrors = {};
        this.transport.dispose();
    }
}

export default TransportAuth;
