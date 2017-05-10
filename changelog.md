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
