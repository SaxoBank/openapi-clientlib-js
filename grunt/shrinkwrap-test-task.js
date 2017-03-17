/**
 * This task checks that the shrinkwrap file exists and throws an error if it doesn't
 * If the file is present, our dependencies are locked down, meaning repeatable builds.
 * To upgrade, you delete the file, update dependencies, npm install, test and then create
 * a new shrinkwrap file
 */

function shrinkwrapTest(grunt) {
    return function () {
        if (!grunt.file.exists("./npm-shrinkwrap.json")) {
            grunt.fail.fatal("The shrinkwrap file must exist.");
        }
    };
}
module.exports = shrinkwrapTest;
