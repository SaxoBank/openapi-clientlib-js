# OpenAPI Client Library

[![Quality-Checks](https://github.com/SaxoBank/openapi-clientlib-js/actions/workflows/quality-checks.yml/badge.svg?branch=master)](https://github.com/SaxoBank/openapi-clientlib-js/actions/workflows/quality-checks.yml)

The OpenApi Client Library a JavaScript library for, among other things, consuming OpenAPI endpoints. 
The library implements all details regarding security, handshake, heartbeat, endpoint data contracts, subscriptions and batching. 
It also has hooks for custom conversion of data and mocked data as well as a bunch of utility functions.

## Building the library

1. Clone the repo  
`git clone https://github.com/saxobank/openapi-clientlib-js`
2. Install Node Modules  
`npm install`
4. Run tasks
`npm run dist` build distribution  
`npm run check` check lint errors and run unit tests

## Publishing

npm version patch | minor | major -m "Upgrade to %s for reasons"
npm publish

## Consuming the library

### Pre-built
#### Namespace Setup
If you are not using a module loader, but instead exposing everything in global, then include the package file in your page before any explicit dependencies.
The library will be output to a global `saxo`. You can then use the library immediately like so: 
`var priceFormatting = new saxo.PriceFormatting(options);`

#### AMD Setup
If you are using a module loader, such as requirejs, then we recommend you alias the path, since the filename contains a version number.
```
requireConfig: {
    // ...
    // consumer requirejs configuration
    path: {
        'openapi-client': 'path/to/openapi-client.js',
        // ...
    }
}
```
You can then require in the file in the normal way and use as above.
```
var openapi = require("openapi-client");
var prices = new openapi.Prices(options);
```

### External dependencies
The library requires below dependencies to be provided in environment where it will be used.

|Dependency |Version                 |Details & URL |
|-----------|------------------------|--------------|
|SignalR    |2.0.3                   |Signal-R can be downloaded from https://github.com/SignalR/SignalR/releases/tag/2.0.3.|
|jQuery     |>1.11                   |We do not depend on jQuery, but SignalR does. You can use any version of jquery that SignalR supports.|
|TextDecoder|                        |TextDecoder is used to decode utf8 JSON string payload for plain websocket transport. |
|           |                        |It will fallback to SignalR if TextDecoder is not available in the environment|

### Browser Support
The library requires an ES5-compatible browser and requires fetch and promises to be available or polyfilled.

### Documentation

Documentation for the API is currently built from the source jsdoc. After cloning the repository, you can build and browse the documentation with the following command:

```bash
npm run build:doc && npx serve doc
```

This will build the documentation and [serve it on http://localhost:5000](http://localhost:5000).

# Contributing

You want to contribute? Great! Have a look at our [contribution guidelines](CONTRIBUTING.md).
