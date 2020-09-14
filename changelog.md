### v.6.2.5

- Use fetch instead of openapi transport for authorization

### v.6.2.4

- Use TextDecoder to decode utf8 string payload

### v.6.2.3

- Fix typed array slice method not supported exception in IE11 and old chrome

### v.6.2.2

- Fix stackoverflow exception during JSON payload parsing.

### v.6.2.1

- More detailed error logging for streaming.

### v.6.2.0

- Refactoring of Plain Websocket Transport reconnecting logic.
- Fixed Plain Websocket Transport error with null contextId.

### v.6.1.0

- Add TransportPutPatchDiagnositicsQueue which waits on any put/patch until a diagnostics call has been made to check if a proxy rejects it and revert to POST instead.

#### v6.0.4

- Allow formatting price up to 8 decimals, avoiding trailing zeroes

#### v6.0.3

- Fix level based retry mechanism by ensuring retryCount is set initially to 0.

#### v6.0.2

- BREAKING - Source is now in ecmascript 2019 (no change to output, only affects if you are using the package source directly and not transpiling)
- BREAKING - AuthProvider has been created on clientLib.openApi.AuthProvider and this needs passing into TransportAuth and Streaming
- BREAKING - RetryTransport is more strict - it only retries if the status matches a provided one or its a network error and retryNetworkError is set
- Add support for leveled delays for streaming reconnects.
- Fix - streaming authentication errors trigger a new token request

#### v5.0.4

- Add support for octet-stream as blobs

#### v5.0.3

- Clone headers passed to subscription to make sure an mutations are not carried over between subscribe requests.

#### v5.0.2

- Add support for json string format for batch responses.

#### v5.0.1

- Patch release including prebuilt dist.

#### v5.0.0

- Add subscription option argument and move optional arguments there.

#### v4.8.0

- Add the state variables to the prototype

#### v4.7.0

- add onQueueEmpty callback to subscription
- change percentage formatter to not include a space

#### v4.6.0

- Implement raw/plain websocket support which allows to drop signalr and use our onw transport layer.

#### v4.5.6

- Fix parsing and do not attempt to stringify FormData.

#### v4.5.5

- Fix broken protobuf fallback logic. Making sure that onerror is not called when falling back from protobuf to json is done.

#### v4.5.4

- Use undefined for body if it's not defined in rest request. This is required to support EDGE fetch handling logic which disallows null body for GET requests. Ref: github/fetch#402

#### v4.5.3

- Add body payload defaulting for PATCH request to fix issue with some proxy configurations not accepting empty PATCH requests.

#### v4.5.2

- Add logging for scenario when signalr fallbacks to longPolling.

#### v4.5.1

- Add x-correlation header data to error log details.

#### v4.5.0

- Improvements to logging
- Switch to Jest
- Remove Grunt
- Upgrade all development packages (incl. rollup and babel)

#### v4.4.0

- Add Localization options for short format

#### v4.3.2

- Add authorization error limits per endpoint.

#### v4.3.1

- Add fallback mechanism for endpoints which don't support protobuf yet

#### v4.3.0

- Improve logging and functionality when a auth token is expired

#### v4.2.0

- Add log messages when requests get stuck

#### v4.1.3

- New FX Swap price formatting

#### v4.1.2

- Improvements for handling network errors
- Tweaks to better detect subscription problems

#### v4.1.1

- Fix parsing of negative modern fractions

#### v4.1.0

- Add billion to the list of shorthands for the short format function.

#### v4.0.2

- Make sure that request ids are unique across requests and batch requests so open api doesnt incorrectly reject them

#### v4.0.1

- If a network error occurs subscribing, we need to unsubscribe - it may have got through

#### v4.0.0

- The retry transport used to retry network errors, but this is now configurable and defaults to not retrying them.

#### v3.0.2

- Fix for-style to be more normal and better performant

#### v3.0.1

- Support negative numbers in short format

#### v3.0.0

- Breaking Change - The signature of the short format function has been changed (breaks if using the precision parameter added in 1.9.0)

#### v2.0.0

- Breaking Change - TransportBatch no longer has an auth argument. It requires that either individual calls have auth headers or that the underlying transport is authenticated
- Breaking change to the batch building utils - it now returns the boundary it will use
- Much smaller batch requests

#### v1.9.3

- Do not format and create "-0" for small negative numbers

#### v1.9.2

- Allow pagination top arguments in subscriptions

#### v1.9.1

- Add nano-precision to protobuf deserialization

#### v1.9.0

- Add precision parameter to short formatter

#### v1.8.0

- Support for Protobuf deserialization

#### v1.7.0

- Add ability to unsubscribe by tag

#### v1.6.0

- No longer send /active as part of the subscribe url

#### v1.5.2

- Align price and number parsing of invalid special futures format values

#### v1.5.1

- Align price and number formatting of non-numbers

#### v1.5.0

- Allow fetchRequest to handle binary responses when content-type is a pdf or an excel
- Add support for decimal values to NumberFormatting.shortFormat
- Increased MS_TO_IGNORE_DATA_ON_UNSUBSCRIBED to 10000 to avoid warning after unsubscribing on slower connections

#### v1.4.0

- Add requestCounter to identify unique request for every open api rest request

#### v1.3.3

- Fix transport retry to send on reject objects correctly
- Remove reference to unused Tag parameters
- Make open api refresh problems warnings when it is due to sleeping on android

#### v1.3.2

- Fix the interface for modify-patch subscriptions

#### v1.3.1

- Fix the language header to be Accept-Language

#### v1.3.0

- Delete subscriptions when a reset occurs
- Allow modifying with a patch request with
- Fixes to the subscription state management

#### v1.2.5

- Use throw instead of return Promise.reject to avoid unnecessary unhandledrejections

#### v1.2.4

- Only try a new action when the connection becomes available if we are not already transitioning

#### v1.2.3

- Improve logging - include url in failed fetch calls

#### v1.2.2

- Improve logging - arguments on failed subscriptions and treat disconnect as a warning

#### v1.2.1

- Dispose the retry transport correctly

#### v1.2.0

- Add custom timeouts based on response code to the retry transport

#### v1.1.0

- Introduce modify method for subscriptions which queues the subscription modification

#### v1.0.3

- Support formatting prices that javascript would format using scientific notation (high precision)

#### v1.0.2

- RetryTransport now only retries if has not received a response (e.g. network failure)

#### v1.0.0

- Initial release to Github
