var path = require('path');

module.exports = {
    entry: {
        extension: './src/extension.ts',
        options: './src/options.ts',
        devtools: './src/devtools.ts',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            { exclude: /node_modules/, test: /\.[jt]sx?$/, loader: 'ts-loader' }
        ]
    }
};
