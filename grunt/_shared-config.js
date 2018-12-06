var sharedConfig = {
    tmp: ".grunt",
    rootNamespace: "saxo",
    dist: "dist",
    releaseFilename: "openapi-client.js"
};

sharedConfig.transpiledSrc = sharedConfig.tmp + "/transpiled-src";
sharedConfig.transpiledSrcRoot = sharedConfig.transpiledSrc + "/saxo";
sharedConfig.release = sharedConfig.dist + "/release";
sharedConfig.releaseFile = sharedConfig.release + "/" + sharedConfig.releaseFilename;

module.exports = sharedConfig;
