'use strict';
module.exports = function (grunt) {

	/* Initialize grunt with configs for the npm packages we depend upon */

	grunt.initConfig({
		clean: require("./grunt/clean-conf"),
		rollup: require("./grunt/rollup-conf"),
		watch: require("./grunt/watch-conf"),
	});

	/* Load tasks for the npm packages we depend upon */

	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-rollup");

	/* Register our own base tasks */

	grunt.registerTask('print', require("./grunt/print-task")(grunt));
	grunt.registerTask("force", require("./grunt/force-task")(grunt));
	grunt.registerTask("shrinkwrap-test", require("./grunt/shrinkwrap-test-task")(grunt));

	/* Register our task chains */

	grunt.registerTask('default', ['print:helptext']);
	grunt.registerTask('dist', ['shrinkwrap-test', 'clean:tmp', 'clean:release', 'rollup:dist', 'print:release']);
};
