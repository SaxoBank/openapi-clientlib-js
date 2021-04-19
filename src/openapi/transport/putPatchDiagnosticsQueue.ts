/**
 * @module saxo/openapi/transport/putPatchDiagnosticsQueue
 * @ignore
 */

import log from '../../log';
import type TransportAuth from './auth';
import type TransportBatch from './batch';
import TransportQueue from './queue';
import type TransportCore from './core';
import type { HTTPMethods } from './types';

// -- Local variables section --

// fix-me typo
const LOG_AREA = 'TransportPutPatchDiagnositicsQueue';

// -- Exported methods section --

/**
 * TransportPutPatchDiagnositicsQueue Waits on sending put and patch calls until a put/patch diagnostics call is successful.
 * If Either are not successful, it calls setUseXHttpMethodOverride with true on the passed transportCore.
 * @class
 * @alias saxo.openapi.TransportPutPatchDiagnositicsQueue
 * @param {saxo.openapi.TransportAuth|saxo.openapi.TransportBatch|saxo.openapi.TransportCore|saxo.openapi.TransportQueue} transport -
 *      The transport to wrap.
 * @param {saxo.openapi.TransportCore} [transportCore] - The core transport at the bottom of the chain.
 */

class TransportPutPatchDiagnositicsQueue {
    isQueueing = true;
    transport: TransportAuth | TransportQueue | TransportBatch | TransportCore;
    transportQueue: TransportQueue;

    constructor(
        transport:
            | TransportAuth
            | TransportQueue
            | TransportBatch
            | TransportCore,
        transportCore: TransportCore,
    ) {
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

    private putPatchTransportMethod(method: HTTPMethods) {
        return (...args: any) => {
            const transport = this.isQueueing
                ? this.transportQueue
                : this.transport;
            return transport[method](...args);
        };
    }

    private otherMethodTransport(method: HTTPMethods) {
        return (...args: any) => this.transport[method](...args);
    }

    get = this.otherMethodTransport('get');
    post = this.otherMethodTransport('post');
    put = this.putPatchTransportMethod('put');
    delete = this.otherMethodTransport('delete');

    patch = this.putPatchTransportMethod('patch');

    head = this.otherMethodTransport('head');
    options = this.otherMethodTransport('options');
}

export default TransportPutPatchDiagnositicsQueue;
