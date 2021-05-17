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

import * as batch from './openapi/batch-util';
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
export type { default as TransportCore } from './openapi/transport/core';
export type { default as TransportAuth } from './openapi/transport/auth';
export type { default as TransportBatch } from './openapi/transport/batch';
export type { default as TransportQueue } from './openapi/transport/queue';
export type { default as TransportRetry } from './openapi/transport/retry';
export type { default as TransportPutPatchDiagnosticsQueue } from './openapi/transport/putPatchDiagnosticsQueue';
export type { default as Streaming } from './openapi/streaming/streaming';
export type { default as AuthProvider } from './openapi/authProvider';
export type { default as Subscription } from './openapi/streaming/subscription';
export type { default as PriceFormatting } from './price-formatting';
export type { default as priceFormatOptions } from './price-formatting/format-options';
export type { default as NumberFormatting } from './number-formatting';
export type { default as MicroEmitter } from './micro-emitter';

export default {
    log,
    MicroEmitter,
    NumberFormatting,
    PriceFormatting,
    priceFormatOptions,
    openapi: {
        AuthProvider,
        batch,
        TransportCore,
        TransportAuth,
        TransportBatch,
        TransportQueue,
        TransportRetry,
        TransportPutPatchDiagnosticsQueue,
        Streaming,
        streamingTransports,
    },
    utils: {
        enum: utilsEnum,
        function: utilsFunction,
        object: utilsObject,
        string: utilsString,
        fetch: utilsFetch,
    },
};
