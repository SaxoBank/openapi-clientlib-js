### v10.10.6

-   Fix errors that can occur if a subscription error occurs

### v10.10.5

-   Fix further bugs that can occur with multiple resets that can result in a stalled subscription

### v10.10.4

-   Fix some bugs that can occur with multiple patches and resets that could result in a stalled subscription

### v10.10.3

-   Added additional logging information

### v10.10.2

-   In some situations delta updates would occur after disposing and this should no longer occur

### v10.10.1

-   Add new binary content type: application/zip

### v10.10.0

-   Add a new shouldLoopTransports option to Streaming

### v10.9.1

-   Fix an issue where we're trying to create stream when connection is not in connected state
-   Fix an issue where we're trying to invoke 'CloseConnection' callback on stream when connection
    is not in connected state

### v10.9.0

-   Remove cleanup subscriptions on close option as we can drop this functionality as it is not needed

### v10.8.10

-   Add an additional content-type that should be text

### v10.8.9

-   Fix an issue with protobuf fallback

### v10.8.8

-   Handle subscription errors on replace better

### v10.8.7

-   Reduce some error logs

### v10.8.6

-   Assume 204 response has no content

### v10.8.5

-   Remove unnecessary warning log

### v10.8.4

-   Reduce log messages and simplify fetch if there is no content

### v10.8.3

-   Fix a issue where a network failure followed quickly by a new token can cause the websocket transport to hang

### v10.8.2

-   Fix a bug where doc/docx are not supporting and add logging so that library can be defaulted to binary type download in future

### v10.8.1

-   Pass a url with a error for correlation

### 10.8.0

-   Remove streaming heartbeat flag and make it always present

### v10.7.1

-   Fix a bug where removing a subscription that is not unsubscribed may prevent the subscription being unsubscribed

### v10.7.0

-   Fetch now rejects with a json error. The isNetworkError property on a fetch rejection is now consistently sent.
-   Added a new option clearSubscriptionsInDispose, which if explicitly set to false will disable a call we believe to be unnecessary

### v10.6.6

-   Expose result object when authorization token failure occurs due to auth issue

### v10.6.5

-   Fix a bug introduced in 10.6.2 where removing a subscription may cause the snapshot event to still fire

### v10.6.4

-   Do not immediately retry ws auth after a network error

### v10.6.3

-   Reset messages when we get missing messages on the streaming messages

### v10.6.2

-   Fallback to JSON if protobuf errors occur either during the snapshot or an update

### v10.6.1

-   Reduce error logs when it is not a error

### v10.6.0

-   Tidy up the support for subscribe before streaming setup

### v10.5.1

-   Fallback to JSON if protobuf errors occur either during the snapshot or an update

### v10.5.0

-   Add support for cloud streaming control message format

### v10.4.2

-   Fix an issue with protobuf support if only SchemaName is sent

### v10.4.1

-   Changed "bearer" removal in network auth handling to work regardless of "bearer" casing

### v10.4.0

-   Added event to streaming class to handle probe messages

### v10.3.1

-   Added contextual information to some error messages

### v10.3.0

-   Add new `isReplace` option for more efficient subscription modifications when an endpoint doesn't support `PATCH`.

### v10.2.9

-   Add shouldSubscribeBeforeStreamingSetup option. New options enables subscribe before streaming setup.

### v10.2.8

-   Convert HTTP method names passed to fetch to uppercase (see: https://bugs.chromium.org/p/chromium/issues/detail?id=1228178)

### v10.2.7

-   Do not warn on messages out of order on reconnections
-   make sure the last message id is passed on reconnect

### v10.2.6

-   Fixes to websocket streaming transport heartbeat to send the parameter on the initial connection

### v10.2.5

-   Do not reset a subscription more than 3 times in a minute

### v10.2.4

-   Make Orphan finder more lenient
-   Log if messages are detected that are not continuous

### v10.2.3

-   Add logging message count on disconnection

### v10.2.2

-   Move heartbeat log data to the right place in the log data

### v10.2.1

-   Debounce detection of multiple orphans

### v10.2.0

-   Add a new event fired when multiple orphans are found

### v10.1.0

-   Add a way to use a heartbeat on pure websockets to detect network issues

### v10.0.1

-   Enhanced getActualDecimals function to support large numbers.
-   Add second argument to shouldUseCloud to have more details and decide if specific endpoint should use cloud (e.g. if supported)

### v10.0.0

#### Breaking

-   Changed exports to be flat and made package side effect free so that tree shaking can occur (e.g. you do not use streaming)

### v9.0.0

#### Breaking

-   micro-emitter becomes a class and needs to be instantiated instead of mixed into an existing object. The class is now exported using the pascal case - MicroEmitter
-   Removed typo - TransportPutPatchDiagnositicsQueue renamed to TransportPutPatchDiagnosticsQueue

### v8.4.2

-   Add support for using fetch signal

### v8.4.0

-   Add pause, resume support to freeze subscriptions

### v8.3.0

-   Remove negotiate call from signalrCore websocket
-   Add signalrCore longpoliing as a fallback

### v8.2.3

-   Fix transport fallback

### v8.2.2

-   Fix rounding numbers

### v8.2.1

-   Fix cloud streaming fallback

### v8.2.0

-   Handle disconnect and reconnect correctly
-   Send close message frame when switching between on-premise and cloud streaming services
-   Add more logs and guards
-   Handle reset messages better - don't spam the server if they spam us

### v8.1.2

-   Better setting of isNetworkError property when fetch fails due to excessive auth errors

### v8.1.1

-   Signalr core - Fixes exception in IE11 if abortController polyfill is not provided
-   Signalr core - Add guard to avoid token renewal request before connection is established

### v8.1.0

-   Allow `useCloud` option to be a function

### v8.0.6

-   Revert rounding fix introduced in v8.0.5

### v8.0.5

-   Fix rounding function that was sometimes inaccurate

### v8.0.4

-   Propogate extended asset types header to batch requests

### v8.0.3

-   Signalr core - send last received message id while reconnecting

### v8.0.2

-   Pure websockets - reconnect immediately on first disconnect

### v8.0.1

-   Some tweaks to protobuf logging messages and data

### v8.0.0

-   BREAKING - Add support for cloud /oapi services. The baseUrl used when constructing transports should no longer include "/openapi"; this is now added by the library.

### v7.2.1

-   Fix some log messages not passing LOG_AREA and add more details to a parsing error

### v7.2.0

-   Update signalr core auth to use websocket for session renewal

### v7.1.0

-   Add signalr core transport support

### v7.0.0

-   BREAKING - Review all log messages. Most network errors and expected events should not be errors or warnings.
-   BREAKING - Remove maxAuthErrors from TransportAuth - we now detect multiple auth errors on a endpoint intelligently
-   BREAKING - Rename authErrorsCleanupDebounce to authErrorsIgnoreDuration
-   Retry failed attempts to update websocket authentication
-   Added new EVENT_STREAMING_FAILED when a streaming connection completely fails
-   If a request for a subscription is sent twice, unsubscribe from the subscription that the library did not receive a response for
-   If an error occurs processing a protobuf message, we now reset the subscription so it isn't stuck

### v6.2.5

-   Use fetch instead of openapi transport for authorization

### v6.2.4

-   Use TextDecoder to decode utf8 string payload

### v6.2.3

-   Fix typed array slice method not supported exception in IE11 and old chrome

### v6.2.2

-   Fix stackoverflow exception during JSON payload parsing.

### v6.2.1

-   More detailed error logging for streaming.

### v6.2.0

-   Refactoring of Plain Websocket Transport reconnecting logic.
-   Fixed Plain Websocket Transport error with null contextId.

### v6.1.0

-   Add TransportPutPatchDiagnositicsQueue which waits on any put/patch until a diagnostics call has been made to check if a proxy rejects it and revert to POST instead.

#### v6.0.4

-   Allow formatting price up to 8 decimals, avoiding trailing zeroes

#### v6.0.3

-   Fix level based retry mechanism by ensuring retryCount is set initially to 0.

#### v6.0.2

-   BREAKING - Source is now in ecmascript 2019 (no change to output, only affects if you are using the package source directly and not transpiling)
-   BREAKING - AuthProvider has been created on clientLib.openApi.AuthProvider and this needs passing into TransportAuth and Streaming
-   BREAKING - RetryTransport is more strict - it only retries if the status matches a provided one or its a network error and retryNetworkError is set
-   Add support for leveled delays for streaming reconnects.
-   Fix - streaming authentication errors trigger a new token request

#### v5.0.4

-   Add support for octet-stream as blobs

#### v5.0.3

-   Clone headers passed to subscription to make sure an mutations are not carried over between subscribe requests.

#### v5.0.2

-   Add support for json string format for batch responses.

#### v5.0.1

-   Patch release including prebuilt dist.

#### v5.0.0

-   Add subscription option argument and move optional arguments there.

#### v4.8.0

-   Add the state variables to the prototype

#### v4.7.0

-   add onQueueEmpty callback to subscription
-   change percentage formatter to not include a space

#### v4.6.0

-   Implement raw/plain websocket support which allows to drop signalr and use our onw transport layer.

#### v4.5.6

-   Fix parsing and do not attempt to stringify FormData.

#### v4.5.5

-   Fix broken protobuf fallback logic. Making sure that onerror is not called when falling back from protobuf to json is done.

#### v4.5.4

-   Use undefined for body if it's not defined in rest request. This is required to support EDGE fetch handling logic which disallows null body for GET requests. Ref: github/fetch#402

#### v4.5.3

-   Add body payload defaulting for PATCH request to fix issue with some proxy configurations not accepting empty PATCH requests.

#### v4.5.2

-   Add logging for scenario when signalr fallbacks to longPolling.

#### v4.5.1

-   Add x-correlation header data to error log details.

#### v4.5.0

-   Improvements to logging
-   Switch to Jest
-   Remove Grunt
-   Upgrade all development packages (incl. rollup and babel)

#### v4.4.0

-   Add Localization options for short format

#### v4.3.2

-   Add authorization error limits per endpoint.

#### v4.3.1

-   Add fallback mechanism for endpoints which don't support protobuf yet

#### v4.3.0

-   Improve logging and functionality when a auth token is expired

#### v4.2.0

-   Add log messages when requests get stuck

#### v4.1.3

-   New FX Swap price formatting

#### v4.1.2

-   Improvements for handling network errors
-   Tweaks to better detect subscription problems

#### v4.1.1

-   Fix parsing of negative modern fractions

#### v4.1.0

-   Add billion to the list of shorthands for the short format function.

#### v4.0.2

-   Make sure that request ids are unique across requests and batch requests so open api doesnt incorrectly reject them

#### v4.0.1

-   If a network error occurs subscribing, we need to unsubscribe - it may have got through

#### v4.0.0

-   The retry transport used to retry network errors, but this is now configurable and defaults to not retrying them.

#### v3.0.2

-   Fix for-style to be more normal and better performant

#### v3.0.1

-   Support negative numbers in short format

#### v3.0.0

-   Breaking Change - The signature of the short format function has been changed (breaks if using the precision parameter added in 1.9.0)

#### v2.0.0

-   Breaking Change - TransportBatch no longer has an auth argument. It requires that either individual calls have auth headers or that the underlying transport is authenticated
-   Breaking change to the batch building utils - it now returns the boundary it will use
-   Much smaller batch requests

#### v1.9.3

-   Do not format and create "-0" for small negative numbers

#### v1.9.2

-   Allow pagination top arguments in subscriptions

#### v1.9.1

-   Add nano-precision to protobuf deserialization

#### v1.9.0

-   Add precision parameter to short formatter

#### v1.8.0

-   Support for Protobuf deserialization

#### v1.7.0

-   Add ability to unsubscribe by tag

#### v1.6.0

-   No longer send /active as part of the subscribe url

#### v1.5.2

-   Align price and number parsing of invalid special futures format values

#### v1.5.1

-   Align price and number formatting of non-numbers

#### v1.5.0

-   Allow fetchRequest to handle binary responses when content-type is a pdf or an excel
-   Add support for decimal values to NumberFormatting.shortFormat
-   Increased MS_TO_IGNORE_DATA_ON_UNSUBSCRIBED to 10000 to avoid warning after unsubscribing on slower connections

#### v1.4.0

-   Add requestCounter to identify unique request for every open api rest request

#### v1.3.3

-   Fix transport retry to send on reject objects correctly
-   Remove reference to unused Tag parameters
-   Make open api refresh problems warnings when it is due to sleeping on android

#### v1.3.2

-   Fix the interface for modify-patch subscriptions

#### v1.3.1

-   Fix the language header to be Accept-Language

#### v1.3.0

-   Delete subscriptions when a reset occurs
-   Allow modifying with a patch request with
-   Fixes to the subscription state management

#### v1.2.5

-   Use throw instead of return Promise.reject to avoid unnecessary unhandledrejections

#### v1.2.4

-   Only try a new action when the connection becomes available if we are not already transitioning

#### v1.2.3

-   Improve logging - include url in failed fetch calls

#### v1.2.2

-   Improve logging - arguments on failed subscriptions and treat disconnect as a warning

#### v1.2.1

-   Dispose the retry transport correctly

#### v1.2.0

-   Add custom timeouts based on response code to the retry transport

#### v1.1.0

-   Introduce modify method for subscriptions which queues the subscription modification

#### v1.0.3

-   Support formatting prices that javascript would format using scientific notation (high precision)

#### v1.0.2

-   RetryTransport now only retries if has not received a response (e.g. network failure)

#### v1.0.0

-   Initial release to Github
