# OpenAPI Client Library

[![Quality-Checks](https://github.com/SaxoBank/openapi-clientlib-js/actions/workflows/quality-checks.yml/badge.svg?branch=master)](https://github.com/SaxoBank/openapi-clientlib-js/actions/workflows/quality-checks.yml)

The OpenApi Client Library a JavaScript library for, among other things, consuming OpenAPI endpoints.
The library implements all details regarding security, handshake, heartbeat, endpoint data contracts, subscriptions and batching.
It also has hooks for custom conversion of data and mocked data as well as a bunch of utility functions.

## Installing

### NPM

`npm install openapi-clientlib`

### YARN

`yarn add openapi-clientlib`

## Building the library

1. Clone the repo  
   `git clone https://github.com/saxobank/openapi-clientlib-js`
2. Install Node Modules  
   `npm install`
3. Run tasks
   `npm run build` build distribution  
   `npm run check` check lint/prettier errors and run unit tests

## Publishing

npm version patch | minor | major -m "Upgrade to %s for reasons"
npm publish

## Consuming the library

The source code of the library is not compiled to any specific ES version. You need to include this library in your build setup and, depending on your app requirements, compile it to any ES version you want.

### External dependencies

The library requires below dependencies to be provided in environment where it will be used.

| Dependency         | Version | Details & URL                                                                                          |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| SignalR            | 2.0.3   | Signal-R can be downloaded from https://github.com/SignalR/SignalR/releases/tag/2.0.3.                 |
| jQuery             | >1.11   | We do not depend on jQuery, but SignalR does. You can use any version of jquery that SignalR supports. |
| TextDecoder        |         | TextDecoder is used to decode utf8 JSON string payload for plain websocket transport.                  |
|                    |         | It will fallback to SignalR if TextDecoder is not available in the environment                         |
| protobufjs         | 6.10.2  | Required only if you will use protobuf parser                                                          |
| @types/signalr     | 2.2.36  | TypeScript projects only - provides types definition for the lib                                       |
| @microsoft/signalr | 5.0.4   | TypeScript projects only - provides types definition for the lib                                       |

### Documentation

Please check doc comments in the source code for additional information.

# Contributing

You want to contribute? Great! Have a look at our [contribution guidelines](CONTRIBUTING.md).
