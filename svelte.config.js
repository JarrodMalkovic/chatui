import adapterStatic from '@sveltejs/adapter-static';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const adapter = process.env.ADAPTER === 'node' ? adapterNode : adapterStatic;
const adapterConfig =
	process.env.ADAPTER === 'node'
		? {
				out: 'build-node'
			}
		: {
				pages: 'build-static',
				assets: 'build-static',
				fallback: '200.html',
				precompress: false,
				strict: true
			};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(adapterConfig)
	}
};

export default config;
