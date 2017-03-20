// Patch Math.random so that we can test functions that use Math.random
Math.random = function () {
    return 0;
};
