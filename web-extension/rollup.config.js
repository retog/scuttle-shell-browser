import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'

const production = !process.env.ROLLUP_WATCH;

export default [{
	input: 'src/background-script.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'webext/background.js',
		intro: 'const global = window;'
	},
	plugins: [
    commonjs(),
    globals(),
		builtins(),
		resolve({
			browser: true,
			dedupe: []
    }),
    json(),
  ],
	watch: {
		clearScreen: false
	}
},
{
	input: 'src/content-script.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'webext/content-script.js',
		intro: 'const global = window;'
	},
	plugins: [
    commonjs(),
    globals(),
		builtins(),
		resolve({
			browser: true,
			dedupe: []
		}),
	],
	watch: {
		clearScreen: false
	}
}]

function serve() {
	let started = false;

	return {
		writeBundle() {
			if (!started) {
				started = true;

				require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
					stdio: ['ignore', 'inherit', 'inherit'],
					shell: true
				});
			}
		}
	};
}
