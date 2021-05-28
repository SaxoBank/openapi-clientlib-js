// Patch Math.random so that we can test functions that use Math.random

function mockMathRandom(returnValue = 0) {
    Math.random = function () {
        return returnValue;
    };
}

export default mockMathRandom;
