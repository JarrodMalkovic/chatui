import adapterStatic from '@sveltejs/adapter-static';
import vercel from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const adapter = process.env.ADAPTER === 'vercel' ? vercel : adapterStatic;
const adapterConfig =
	process.env.ADAPTER === 'vercel'
		? {
				out: 'build-vercel'
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
