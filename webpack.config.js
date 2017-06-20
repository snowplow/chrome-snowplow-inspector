var path = require('path');

module.exports = {
    entry: './src/extension.js',
    output: {
        filename: 'extension.js',
        path: path.resolve(__dirname, 'dist')
    }
};
