/**
  * Configures jshint to run on everything
  */

var globalOptions = {
	"boss": true,
	"esnext": true,
	"evil": true,
	"latedef": "nofunc",
	"node": true,
	"undef": true,
	"unused": "vars",
	"noarg": true,
	"eqnull": true,
	"forin": true,
	"proto": true,
	"predef": ["fetch", "Promise", "MessageChannel", "$", "location", "-console"]
};

var defaultTask = {
	src: [
		'src/**/*.js',
		'Gruntfile.js',
		'grunt/*.js',
		'!grunt/output-template.js'
	]
};

module.exports = {
	options: globalOptions,
	"default": defaultTask
};
