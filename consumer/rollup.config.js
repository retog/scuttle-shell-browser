import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias';

const production = !process.env.ROLLUP_WATCH;

export default [{
	input: 'src/connect-ssb-page-script.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'site/connect-ssb.js',
		intro: 'const global = window;'
	},
	plugins: [
    commonjs(),
    alias({
      entries: [
        { find: 'crypto', replacement: 'crypto-browserify' }
      ]
    }),
    globals(),
    json(),
    builtins(),
		resolve({
			browser: true,
			dedupe: []
		}),
		

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('site'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		// production && terser()
	],
	watch: {
		clearScreen: false
	}
}, {
	input: 'src/ssb-connect.js',
	output: {
		sourcemap: true,
		format: 'es',
		file: 'site/ssb-connect.js'
	},
	plugins: [
    commonjs(),
    alias({
      entries: [
        { find: 'crypto', replacement: 'crypto-browserify' }
      ]
    }),
    globals(),
    json(),
    builtins(),
		resolve({
			browser: true,
			dedupe: []
    }),
    
		

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('site'),

		terser()
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
