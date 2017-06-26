/**
  * This task outputs information to the console to help developers
  */
var sharedConfig = require("./_shared-config");

var bold = '\x1b[1m';
var reset = '\x1b[0m';
var indent = '   ';
var txt = {
    'coverage': [
        bold + 'Generated code coverage report has been placed in dist/coverage' + reset
    ],
    'release': [
        bold + 'Generated js library has been placed in ' + sharedConfig.release + reset
    ],
    'jasmine-spec-runner': [
        bold + 'Get to the basic unit-tests with this url:' + reset,
        '',
        bold + indent + sharedConfig.serverBaseURL + sharedConfig.jasmineTestUnitOutputFile + reset,
        '',
        bold + 'Other test-runners available are:' + reset,
        '',
        bold + indent + sharedConfig.serverBaseURL + sharedConfig.jasmineBuildRequireJSOutputFile + reset,
        bold + indent + sharedConfig.serverBaseURL + sharedConfig.jasmineCoverageOutputFile + reset,
        bold + indent + sharedConfig.serverBaseURL + sharedConfig.jasmineTestIntegrationOutputFile + reset
    ],
    'helptext': [
        bold + 'The following grunt commands are available' + reset,
        '',
        bold + indent + 'grunt dist' + reset + ' (Bundle the source into a single distributable file)',
        bold + indent + 'npm run lint' + reset + ' (Run eslint to check for errors)',
        bold + indent + 'npm run lint:fix' + reset + ' (Run eslint and autofix anything it can)',
        bold + indent + 'grunt test' + reset + ' (Run our unittests and build a code coverage report)',
        bold + indent + 'grunt test-watch' + reset + ' (Run the unittests under a watch - auto reruns tests when code changes)',
        bold + indent + 'grunt test-server' + reset + ' (Run the unittests in your own browser - sets up a server you can connect to)',
        bold + indent + 'grunt test-build' + reset + ' (Tests that the build mechanism works)',
    ]
};

function createPrint(grunt) {
    return function (subTask) {
        var lines = txt[subTask];
        grunt.log.writeln();
        for (var i = 0, l = lines.length; i < l; i++) {
            grunt.log.writeln(lines[i]);
        }
    };
}

module.exports = createPrint;
