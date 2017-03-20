var sharedConfig = {
    serverBaseURL: 'http://localhost:8081/',
    tmp: ".grunt",
    rootNamespace: "saxo",
    dist: "dist",
    releaseFilename: "openapi-client.js"
};

sharedConfig.transpiledSrc = sharedConfig.tmp + "/transpiled-src";
sharedConfig.transpiledSrcRoot = sharedConfig.transpiledSrc + "/saxo";
sharedConfig.rolledupTests = sharedConfig.tmp + "/rolledup-tests";
sharedConfig.release = sharedConfig.dist + "/release";
sharedConfig.releaseFile = sharedConfig.release + "/" + sharedConfig.releaseFilename;
sharedConfig.jasmineCoverageOutputFile = sharedConfig.tmp + '/coverage-runner.html';
sharedConfig.jasmineBuildRequireJSOutputFile = sharedConfig.tmp + '/require-runner.html';
sharedConfig.jasmineTestBuildOutputFile = sharedConfig.tmp + '/build-runner.html';
sharedConfig.jasmineTestUnitOutputFile = sharedConfig.tmp + '/spec-runner.html';
sharedConfig.jasmineTestIntegrationOutputFile = sharedConfig.tmp + '/integration-runner.html';


module.exports = sharedConfig;
