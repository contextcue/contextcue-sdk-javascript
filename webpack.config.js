const path = require('path');

module.exports = {
	entry: './src/index.ts',
	devtool: 'source-map',
	mode: 'production',
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
	resolve: {
		extensions: ['.ts', '.js']
	},
	output: {
		filename: 'adsbycontextcue.js',
		path: path.resolve(__dirname, 'dist')
	}
};
