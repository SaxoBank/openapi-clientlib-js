var src = [
    'src/**/*.js',
];

module.exports = {
    options: {
        cache: true,
        ignore: true,
        quiet: true, // don't show warnings because eslint warns about ignored files (https://github.com/sindresorhus/grunt-eslint/issues/119)
                     // all our config is errors.
    },
    check: {
        src: src,
    },
    fix: {
        src: src,
        options: {
            fix: true,
        },
    },
};
