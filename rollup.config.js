const packageConfig = require('./package.json');
const fs = require('fs');
const babel = require('rollup-plugin-babel');

const sharedConfig = {
    tmp: '.grunt',
    rootNamespace: 'saxo',
    dist: 'dist',
    releaseFilename: 'openapi-client.js',
};

sharedConfig.transpiledSrc = sharedConfig.tmp + '/transpiled-src';
sharedConfig.transpiledSrcRoot = sharedConfig.transpiledSrc + '/saxo';
sharedConfig.release = sharedConfig.dist + '/release';
sharedConfig.releaseFile = sharedConfig.release + '/' + sharedConfig.releaseFilename;

// prepare the template. This will provide the banner and footer allowing us greater control
// we could use the format: "umd" but we wouldn't be able to merge the namespaces when used
// without amd
const exportName = sharedConfig.rootNamespace;
const outputParts = fs.readFileSync('./grunt/output-template.js', { encoding: 'utf8' })
    .replace(/'EXPORT_PLACEHOLDER'/g, exportName)
    .replace(/'NS_PLACEHOLDER'/g, sharedConfig.rootNamespace)
    .replace('\'OUTPUT_NAME\'', packageConfig.name)
    .replace('\'OUTPUT_VERSION\'', packageConfig.version)
    .split('/*SPLIT PLACEHOLDER FOR ROLLUP*/');

module.exports = [{
    input: './src/openapi-package.js',
    output: {
        file: sharedConfig.releaseFile,
        format: 'iife',
        sourcemap: true,
        name: exportName,
        banner: outputParts[0],
        footer: outputParts[1],
    },
    plugins: [
        babel(),
    ],
}];
