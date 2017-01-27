/**
  * shell runs shell commands. In the libraries case we use it to run jsdoc, because
  * grunt jsdoc is an incredibly thin abstraction and allows us to control the version
  */

var jsdocTask = {
	command: "node node_modules/jsdoc-75lb/jsdoc.js -c grunt/jsdoc-conf.json"
};

module.exports = {
	jsdoc: jsdocTask
};