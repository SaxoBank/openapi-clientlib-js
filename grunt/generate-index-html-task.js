/**
 * This task puts generate the index.html file for the release, based on the index-template.html file.
 */

var package = require("../package.json");
var sharedConfig = require("./_shared-config");

function generateIndexHtml(grunt) {
	return function () {
		var html = grunt.file.read("index-template.html")
					.replace(/\$version/g, package.version)
					.replace(/\$filename/g, sharedConfig.releaseFilename);
		grunt.file.write("dist/index.html", html);
	};
}

module.exports = generateIndexHtml;
