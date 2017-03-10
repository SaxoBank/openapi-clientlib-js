# OpenAPI Client Library

[![Build Status](https://travis-ci.org/SaxoBank/openapi-clientlib-js.svg?branch=master)](https://travis-ci.org/SaxoBank/openapi-clientlib-js)
[![API Doc](https://doclets.io/SaxoBank/openapi-clientlib-js/master.svg)](https://doclets.io/SaxoBank/openapi-clientlib-js/master)

The OpenApi Client Library a JavaScript library for, among other things, consuming OpenAPI endpoints. 
The library implements all details regarding security, handshake, heartbeat, endpoint data contracts, subscriptions and batching. 
It also has hooks for custom conversion of data and mocked data as well as a bunch of utility functions.

## Building the library

1. Clone the repo  
`git clone https://github.com/saxobank/openapi-clientlib-js`
2. Install Node Modules  
`npm install`
3. Install Grunt
`npm install -g grunt-cli`
4. Run grunt tasks
`grunt` display a list of possible commands  
`grunt jsdoc` build documentation  
`grunt dist` build distribution  
`grunt test` run unit tests  

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
|jQuery     |>1.11                  |We do not depend on jQuery, but SignalR does. You can use any version of jquery that SignalR supports.|

### Browser Support
The library requires an ES5-compatible browser and requires fetch and promises to be available or polyfilled.

### Documentation

Documentation for the API is built from the source jsdoc and [available on doclets.io](https://doclets.io/SaxoBank/openapi-clientlib-js/master).

# Contributing
You want to contribute? Great! Have a look at our [contribution guidelines](CONTRIBUTING.md).