/**
  * The jasmine task generates the test spec files
  * and it can also run them in node.js through phantomjs
  */

var sharedConfig = require("./_shared-config");

var globalOptions = {
    keepRunner: true, // doesn't delete the spec html files after completing
    host: 'http://localhost:8081/', // website hosted by the connect task
    display: 'none',
    summary: true,
    vendor: [
        "node_modules/whatwg-fetch/fetch.js",
        "node_modules/es6-promise/dist/es6-promise.js",
        "node_modules/jquery/dist/jquery.min.js",
        "libs/jquery.signalR-2.0.3.js"]
};

// coverage task - runs jasmine with istanbul in order to get code coverage
// istanbul is a tool that instruments the source and then extracts out the statistics and generates reports
// here the grunt-template-jasmine-istanbul package is instrumenting the source and creating the coverage
// information. See the coverage-task for where the reports are generated.
var coverageTask = {
    src: [sharedConfig.releaseFile],
    options: {
        specs: [sharedConfig.rolledupTests + '/unit/**/*-spec.js'],
        outfile: sharedConfig.jasmineCoverageOutputFile,
        template: require('grunt-template-jasmine-istanbul'),
        templateOptions: {
            coverage: sharedConfig.dist + '/coverage/coverage.json',
            report: []
        }
    }
};

// Runs the requirejs wrapper test
var buildRequireJSTask = {
    options: {
        specs: [sharedConfig.rolledupTests + '/build/**/*-spec.js'],
        outfile: sharedConfig.jasmineBuildRequireJSOutputFile
    }
};

// Generates a test runner that can be used to debug the tests without bundles or coverage - used to debug the tests in a browser
var unitTask = {
    src: [sharedConfig.releaseFile],
    options: {
        specs: [sharedConfig.rolledupTests + '/unit/**/*-spec.js'],
        outfile: sharedConfig.jasmineTestUnitOutputFile
    }
};

// Runs the integration tests
var integrationTask = {
    src: [sharedConfig.releaseFile],
    options: {
        specs: [sharedConfig.rolledupTests + '/integration/**/*-spec.js'],
        outfile: sharedConfig.jasmineTestIntegrationOutputFile
    }
};

module.exports = {
    options: globalOptions,
    'coverage': coverageTask,
    'build-requirejs': buildRequireJSTask,
    'unit': unitTask,
    'integration': integrationTask
};
