import { jstsExtractor, svelteExtractor } from 'svelte-i18n-lingui/extractor';

export default {
	locales: ['en', 'zh'],
	sourceLocale: 'en',
	catalogs: [
		{
			path: 'src/locales/{locale}',
			include: ['src/lib', 'src/components', 'src/routes']
		}
	],
	extractors: [jstsExtractor, svelteExtractor]
};
