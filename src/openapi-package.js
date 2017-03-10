import * as utils_enum from './utils/enum';
import * as utils_object from './utils/object';
import * as utils_string from './utils/string';
import utils_fetch from './utils/fetch';

import PriceFormatting from './price-formatting/price-formatting';
import priceFormatOptions from './price-formatting/format-options';
import NumberFormatting from './number-formatting/number-formatting';

import log from './log';
import microEmitter from './micro-emitter';

import * as batch from './openapi/batch-util';
import TransportCore from './openapi/transport/core';
import TransportAuth from './openapi/transport/auth';
import TransportBatch from './openapi/transport/batch';
import TransportQueue from './openapi/transport/queue';
import TransportRetry from './openapi/transport/retry';
import Streaming from './openapi/streaming/streaming';
import StreamingOrphanFinder from './openapi/streaming/orphan-finder';
import StreamingSubscription from './openapi/streaming/subscription';

export default {
	log: log,
	microEmitter: microEmitter,
	NumberFormatting: NumberFormatting,
	PriceFormatting: PriceFormatting,
	priceFormatOptions: priceFormatOptions,
	openapi: {
		batch: batch,
		TransportCore: TransportCore,
		TransportAuth: TransportAuth,
		TransportBatch: TransportBatch,
		TransportQueue: TransportQueue,
        TransportRetry: TransportRetry,
		Streaming: Streaming,
		// privates exposed for testing
		_StreamingOrphanFinder: StreamingOrphanFinder,
		_StreamingSubscription: StreamingSubscription,
	},
	utils: {
		"enum": utils_enum,
		"object": utils_object,
		"string": utils_string,
		fetch: utils_fetch
	}
};
