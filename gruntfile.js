'use strict';
module.exports = function (grunt) {

	/* Initialize grunt with configs for the npm packages we depend upon */

	grunt.initConfig({
		clean: require("./grunt/clean-conf"),
		connect: require("./grunt/connect-conf"),
		jasmine: require("./grunt/jasmine-conf"),
		eslint: require("./grunt/eslint-conf"),
		rollup: require("./grunt/rollup-conf"),
		watch: require("./grunt/watch-conf"),
		remapIstanbul: require("./grunt/remap-istanbul-conf")
	});

	/* Load tasks for the npm packages we depend upon */

	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-connect");
	grunt.loadNpmTasks("grunt-contrib-jasmine");
	grunt.loadNpmTasks("grunt-eslint");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-rollup");
	grunt.loadNpmTasks('remap-istanbul');

	/* Register our own base tasks */

	grunt.registerTask('print', require("./grunt/print-task")(grunt));
	grunt.registerTask("force", require("./grunt/force-task")(grunt));
	grunt.registerTask("shrinkwrap-test", require("./grunt/shrinkwrap-test-task")(grunt));

	/* Register our task chains */

	grunt.registerTask('default', ['print:helptext']);
	grunt.registerTask('dist', ['shrinkwrap-test', 'clean:tmp', 'clean:release', 'rollup:dist', 'print:release']);

	// Test Tasks
	grunt.registerTask('test', ['eslint:check', 'dist', 'rollup:test', 'connect', 'jasmine:unit', 'jasmine:build-requirejs']);
	grunt.registerTask('test-coverage', ['eslint:check', 'dist', 'clean:coverage', 'rollup:test', 'connect', 'jasmine:coverage', 'remapIstanbul']);
	grunt.registerTask('test-build', ['eslint:check', 'dist', 'rollup:test', 'connect', 'jasmine:build-requirejs']);

	grunt.registerTask('test-watch', ['force:on', 'test-coverage', 'watch:js-test-watch']);

	// setup a web server to run the browser tests in a browser rather than phantom
	grunt.registerTask('test-server', ['clean:release', 'rollup:test', 'rollup:dist', 'jasmine::build', 'connect', 'print:jasmine-spec-runner', 'watch:js-test-server-watch']);

	grunt.registerTask('test-integration', ['dist', 'rollup:test', 'clean:tmp', 'connect', 'jasmine:integration']);
};
