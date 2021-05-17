import log from '../../log';
import TransportQueue from './queue';
import type TransportCore from './core';
import type { HTTPMethodType } from '../../utils/fetch';
import type { ITransport } from './transport-base';

// fix-me typo
const LOG_AREA = 'TransportPutPatchDiagnositicsQueue';

/**
 * TransportPutPatchDiagnositicsQueue Waits on sending put and patch calls until a put/patch diagnostics call is successful.
 * If Either are not successful, it calls setUseXHttpMethodOverride with true on the passed transportCore.
 *
 * @param transport -
 *      The transport to wrap.
 * @param transportCore - (optional) The core transport at the bottom of the chain.
 */
class TransportPutPatchDiagnositicsQueue {
    isQueueing = true;
    transport: ITransport;
    transportQueue: TransportQueue;

    constructor(transport: ITransport, transportCore: TransportCore) {
        if (!transport) {
            throw new Error(
                'Missing required parameter: transport in TransportPutPatchDiagnositicsQueue',
            );
        }
        if (!transportCore) {
            throw new Error(
                'Missing required parameter: transportCore in TransportPutPatchDiagnositicsQueue',
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

    private putPatchTransportMethod(method: 'put' | 'patch') {
        return (...args: any) => {
            const transport = this.isQueueing
                ? this.transportQueue
                : this.transport;
            return transport[method](...args);
        };
    }

    private otherMethodTransport(method: HTTPMethodType) {
        return (...args: any) => this.transport[method](...args);
    }

    put = this.putPatchTransportMethod('put');
    patch = this.putPatchTransportMethod('patch');

    get = this.otherMethodTransport('get');
    post = this.otherMethodTransport('post');
    delete = this.otherMethodTransport('delete');
    head = this.otherMethodTransport('head');
    options = this.otherMethodTransport('options');
}

export default TransportPutPatchDiagnositicsQueue;
