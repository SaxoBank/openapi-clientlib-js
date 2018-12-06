/**
  *  Deletes directories for a clean build
  */

var sharedConfig = require("./_shared-config");

var tmpTask = [sharedConfig.tmp];
var docTask = ['dist/doc'];
var releaseTask = ['dist/release'];

module.exports = {
    tmp: tmpTask,
    doc: docTask,
    release: releaseTask,
};
