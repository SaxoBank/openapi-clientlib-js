/*
  This task "rolls up" files that have imported each other into a single bundle.
  The 'dist' subtask takes the multiple transpiled source files and creates the bundle.
  The 'test' subtask merges together spec files with any dependencies so that the tests
  do not need requirejs to run.
*/
var packageConfig = require("../package.json");
var sharedConfig = require("./_shared-config");
var fs = require("fs");
var babel = require("rollup-plugin-babel");
var resolve = require("rollup-plugin-node-resolve");
var commonJs = require("rollup-plugin-commonjs");

// prepare the template. This will provide the banner and footer allowing us greater control
// we could use the format: "umd" but we wouldn't be able to merge the namespaces when used
// without amd
var exportName = sharedConfig.rootNamespace;
var outputParts = fs.readFileSync("grunt/output-template.js", { encoding: 'utf8' })
    .replace(/'EXPORT_PLACEHOLDER'/g, exportName)
    .replace(/'NS_PLACEHOLDER'/g,  sharedConfig.rootNamespace)
    .replace("'OUTPUT_NAME'",  packageConfig.name)
    .replace("'OUTPUT_VERSION'",  packageConfig.version)
    .split("/*SPLIT PLACEHOLDER FOR ROLLUP*/");

module.exports = {
    options: {
        sourceMap: true,
        sourceMapRelativePaths: true
    },
    dist: {
        options: {
            format: "iife",
            moduleName: exportName,
            banner: outputParts[0],
            footer: outputParts[1],
            plugins: [
                resolve(),
                commonJs(),
                babel()
            ]
        },
        files: [
            {
                src: "src/openapi-package.js",
                dest: sharedConfig.releaseFile
            }
        ]
    },
    test: {
        options: {
            format: "iife",
            plugins: [
                resolve(),
                commonJs(),
                babel()
            ]
        },
        files: [
            {
                expand: true,
                cwd: 'test',
                src: ['**/*-spec.js'],
                dest: '.grunt/rolledup-tests'
            }
        ]
    }
};
