/**
 * This convenience task can be used to switch force on and off.
 * The force option says that if true a task with errors will not cause grunt to exit (with an error code)
 * Its used when watching so that a compile or test error doesn't stop watching
 */

function force(grunt) {
	return function (set) {
		if (set === "on") {
			grunt.option("force", true);
		}
		else if (set === "off") {
			grunt.option("force", false);
		}
	};
}

module.exports = force;
