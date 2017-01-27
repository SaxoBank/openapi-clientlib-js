/*
  This takes the coverage json file generated in jasmine-conf and maps it through
  sourcemaps (rollup & babel) so that the coverage is on the original files. It then
  generates the reports.
*/
var sharedConfig = require("./_shared-config");

module.exports = {
		build: {
			src: sharedConfig.dist + '/coverage/coverage.json',
			options: {
				reports: {
					'json': sharedConfig.dist + '/coverage/coverage-final.json',
					'html': sharedConfig.dist + '/coverage/',
					'text': null
				}
			}
		}
};
