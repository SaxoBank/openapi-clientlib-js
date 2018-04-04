#### v2.0.0

+ Breaking Change - TransportBatch no longer has an auth argument. It requires that either individual calls have auth headers or that the underlying transport is authenticated
+ Breaking change to the batch building utils - it now returns the boundary it will use
+ Much smaller batch requests

#### v1.9.3

+ Do not format and create "-0" for small negative numbers

#### v1.9.2

+ Allow pagination top arguments in subscriptions

#### v1.9.1

+ Add nano-precision to protobuf deserialization

#### v1.9.0

+ Add precision parameter to short formatter

#### v1.8.0

+ Support for Protobuf deserialization

#### v1.7.0

+ Add ability to unsubscribe by tag

#### v1.6.0

+ No longer send /active as part of the subscribe url

#### v1.5.2

+ Align price and number parsing of invalid special futures format values

#### v1.5.1

+ Align price and number formatting of non-numbers

#### v1.5.0

+ Allow fetchRequest to handle binary responses when content-type is a pdf or an excel
+ Add support for decimal values to NumberFormatting.shortFormat
+ Increased MS_TO_IGNORE_DATA_ON_UNSUBSCRIBED to 10000 to avoid warning after unsubscribing on slower connections


#### v1.4.0

+ Add requestCounter to identify unique request for every open api rest request

#### v1.3.3

+ Fix transport retry to send on reject objects correctly
+ Remove reference to unused Tag parameters
+ Make open api refresh problems warnings when it is due to sleeping on android

#### v1.3.2

+ Fix the interface for modify-patch subscriptions

#### v1.3.1

+ Fix the language header to be Accept-Language

#### v1.3.0

+ Delete subscriptions when a reset occurs
+ Allow modifying with a patch request with
+ Fixes to the subscription state management

#### v1.2.5

+ Use throw instead of return Promise.reject to avoid unnecessary unhandledrejections

#### v1.2.4

+ Only try a new action when the connection becomes available if we are not already transitioning

#### v1.2.3

+ Improve logging - include url in failed fetch calls

#### v1.2.2

+ Improve logging - arguments on failed subscriptions and treat disconnect as a warning

#### v1.2.1

+ Dispose the retry transport correctly

#### v1.2.0

+ Add custom timeouts based on response code to the retry transport

#### v1.1.0

+ Introduce modify method for subscriptions which queues the subscription modification

#### v1.0.3

+ Support formatting prices that javascript would format using scientific notation (high precision)

#### v1.0.2

+ RetryTransport now only retries if has not received a response (e.g. network failure)

#### v1.0.0

+ Initial release to Github
