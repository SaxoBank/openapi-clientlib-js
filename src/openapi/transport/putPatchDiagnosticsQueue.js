/**
 * @module saxo/openapi/transport/putPatchDiagnosticsQueue
 * @ignore
 */

import log from '../../log';
import TransportQueue from './queue';

// -- Local variables section --

const LOG_AREA = 'TransportPutPatchDiagnositicsQueue';

// -- Local methods section --

function putPatchTransportMethod(method) {
    return function() {
        const transport = this.isQueueing
            ? this.transportQueue
            : this.transport;
        return transport[method].apply(transport, arguments);
    };
}

function otherMethodTransport(method) {
    return function() {
        return this.transport[method].apply(this.transport, arguments);
    };
}

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
function TransportPutPatchDiagnositicsQueue(transport, transportCore) {
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

    this.isQueueing = true;
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
                log.debug(LOG_AREA, 'Diagnostics checks finished, continuing');
                this.isQueueing = false;
            }),
    );
}

/**
 * Performs a queued get request.
 * @see {@link saxo.openapi.TransportCore#get}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.get = otherMethodTransport('get');

/**
 * Performs a queued post request.
 * @see {@link saxo.openapi.TransportCore#post}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.post = otherMethodTransport(
    'post',
);

/**
 * Performs a queued put request.
 * @see {@link saxo.openapi.TransportCore#put}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.put = putPatchTransportMethod(
    'put',
);

/**
 * Performs a queued delete request.
 * @see {@link saxo.openapi.TransportCore#delete}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.delete = otherMethodTransport(
    'delete',
);

/**
 * Performs a queued patch request.
 * @see {@link saxo.openapi.TransportCore#patch}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.patch = putPatchTransportMethod(
    'patch',
);

/**
 * Performs a queued head request.
 * @see {@link saxo.openapi.TransportCore#head}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.head = otherMethodTransport(
    'head',
);

/**
 * Performs a queued options request.
 * @see {@link saxo.openapi.TransportCore#options}
 * @function
 */
TransportPutPatchDiagnositicsQueue.prototype.options = otherMethodTransport(
    'options',
);

// -- Export section --

export default TransportPutPatchDiagnositicsQueue;
