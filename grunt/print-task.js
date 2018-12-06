/**
  * This task outputs information to the console to help developers
  */
var sharedConfig = require("./_shared-config");

var bold = '\x1b[1m';
var reset = '\x1b[0m';
var indent = '   ';
var txt = {
    'release': [
        bold + 'Generated js library has been placed in ' + sharedConfig.release + reset
    ],
    'helptext': [
        bold + 'The following grunt commands are available' + reset,
        '',
        bold + indent + 'npm run dist' + reset + ' (Bundle the source into a single distributable file)',
        bold + indent + 'npm run lint' + reset + ' (Run eslint to check for errors)',
        bold + indent + 'npm run lint:fix' + reset + ' (Run eslint and autofix anything it can)',
        bold + indent + 'npm run jest' + reset + ' (Run our unittests and build a code coverage report)',
        bold + indent + 'npm run jest:watch' + reset + ' (Run the unittests under a watch - auto reruns tests when code changes)',
        bold + indent + 'npm run jest:debug' + reset + ' (Run the unittests in debug mode - ready to attach the chrome debugger)',
        bold + indent + 'npm run dist-watch' + reset + ' (Watch the source and build when it changes)',
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
