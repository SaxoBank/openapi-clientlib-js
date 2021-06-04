import * as utilsEnum from './utils/enum';
import * as utilsFunction from './utils/function';
import * as utilsObject from './utils/object';
import * as utilsString from './utils/string';
import utilsFetch from './utils/fetch';

import PriceFormatting from './price-formatting';
import priceFormatOptions from './price-formatting/format-options';
import NumberFormatting from './number-formatting';

import log from './log';
import MicroEmitter from './micro-emitter';

import * as batchUtil from './openapi/batch-util';
import TransportCore from './openapi/transport/core';
import TransportAuth from './openapi/transport/auth';
import TransportBatch from './openapi/transport/batch';
import TransportQueue from './openapi/transport/queue';
import TransportRetry from './openapi/transport/retry';
import TransportPutPatchDiagnosticsQueue from './openapi/transport/putPatchDiagnosticsQueue';
import Streaming from './openapi/streaming/streaming';
import * as streamingTransports from './openapi/streaming/connection/transportTypes';
import AuthProvider from './openapi/authProvider';

export type {
    OAPIRequestResult,
    QueryParams,
    StringTemplateArgs,
    HTTPMethod,
    RequestOptions,
} from './types';
export type { StreamingMessage } from './openapi/streaming/types';
export type { default as Subscription } from './openapi/streaming/subscription';
export type { IEventEmitter, EventTypes } from './micro-emitter';

export {
    log,
    MicroEmitter,
    NumberFormatting,
    PriceFormatting,
    priceFormatOptions,
    AuthProvider,
    batchUtil,
    TransportCore,
    TransportAuth,
    TransportBatch,
    TransportQueue,
    TransportRetry,
    TransportPutPatchDiagnosticsQueue,
    Streaming,
    streamingTransports,
    utilsEnum,
    utilsFunction,
    utilsObject,
    utilsString,
    utilsFetch,
};
