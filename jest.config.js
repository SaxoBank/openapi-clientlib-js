const config = {
    verbose: false,
    testPathIgnorePatterns: ['/node_modules/', '/esnext/'],
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
    },
    moduleDirectories: ['node_modules', '<rootDir>'],
    testEnvironment: 'jsdom',
    restoreMocks: true,
    coverageDirectory: 'coverage/',
    coverageReporters: ['html-spa', ['text', { skipFull: true }]],
};

module.exports = config;
