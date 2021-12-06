import log from '../../log';
import TransportQueue from './queue';
import type TransportCore from './core';
import type {
    HTTPMethodType,
    HTTPMethod,
    StringTemplateArgs,
    RequestOptions,
} from '../../types';
import type { ITransport } from './transport-base';

const LOG_AREA = 'TransportPutPatchDiagnosticsQueue';

/**
 * TransportPutPatchDiagnosticsQueue Waits on sending put and patch calls until a put/patch diagnostics call is successful.
 * If Either are not successful, it calls setUseXHttpMethodOverride with true on the passed transportCore.
 *
 * @param transport -
 *      The transport to wrap.
 * @param transportCore - (optional) The core transport at the bottom of the chain.
 */
class TransportPutPatchDiagnosticsQueue implements ITransport {
    isQueueing = true;
    transport: ITransport;
    transportQueue: TransportQueue;

    constructor(transport: ITransport, transportCore: TransportCore) {
        if (!transport) {
            throw new Error(
                'Missing required parameter: transport in TransportPutPatchDiagnosticsQueue',
            );
        }
        if (!transportCore) {
            throw new Error(
                'Missing required parameter: transportCore in TransportPutPatchDiagnosticsQueue',
            );
        }

        this.transport = transport;
        this.transportQueue = new TransportQueue(transport);

        const diagnosticsPut = transportCore.put('root', 'v1/diagnostics/put');

        const diagnosticsPatch = transportCore.patch(
            'root',
            'v1/diagnostics/patch',
        );

        this.transportQueue.waitFor(
            Promise.all([diagnosticsPut, diagnosticsPatch])
                .catch(() => {
                    transportCore.setUseXHttpMethodOverride(true);
                    log.info(
                        LOG_AREA,
                        'Diagnostic check for put/patch failed. Fallback to POST used',
                    );
                })
                .then(() => {
                    log.debug(
                        LOG_AREA,
                        'Diagnostics checks finished, continuing',
                    );
                    this.isQueueing = false;
                }),
        );
    }

    private putPatchTransportMethod(method: 'put' | 'patch'): HTTPMethod {
        return (
            servicePath: string,
            urlTemplate: string,
            templateArgs?: StringTemplateArgs,
            options?: RequestOptions,
        ) => {
            const transport = this.isQueueing
                ? this.transportQueue
                : this.transport;
            return transport[method](
                servicePath,
                urlTemplate,
                templateArgs,
                options,
            );
        };
    }

    private otherMethodTransport(method: HTTPMethodType) {
        return (
            servicePath: string,
            urlTemplate: string,
            templateArgs?: StringTemplateArgs,
            options?: RequestOptions,
        ) =>
            this.transport[method](
                servicePath,
                urlTemplate,
                templateArgs,
                options,
            );
    }

    put = this.putPatchTransportMethod('put');
    patch = this.putPatchTransportMethod('patch');

    get = this.otherMethodTransport('get');
    post = this.otherMethodTransport('post');
    delete = this.otherMethodTransport('delete');
    head = this.otherMethodTransport('head');
    options = this.otherMethodTransport('options');

    dispose() {
        this.transport.dispose();
    }
}

export default TransportPutPatchDiagnosticsQueue;
