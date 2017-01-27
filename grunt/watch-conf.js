var jsTestServerWatchTask = {
	files: ['src/**/*.js', 'test/**/*.js'],
	tasks: ['rollup:dist', 'rollup:test']
};

var jsTestWatchTask = {
	files: ['src/**/*.js', 'test/**/*.js'],
	tasks: ['rollup:dist', 'rollup:test', 'jasmine:coverage']
};

var distWatchTask = {
	files: ['src/**/*.js'],
	tasks: ["dist"]
};

module.exports = {
	'js-test-server-watch': jsTestServerWatchTask,
	'js-test-watch': jsTestWatchTask,
	'dist-watch': distWatchTask
};
