<script lang="ts">
	import '../app.css';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
	import { locale } from 'svelte-i18n-lingui';
	import { browser } from '$app/environment';

	inject({ mode: dev ? 'development' : 'production' });

	export let data;

	async function setLocale(languageCode: string) {
		const { messages } = await import(`../locales/${languageCode}.ts`);
		locale.set(languageCode, messages);
		console.log('set language to ', languageCode);
	}

	$: if (data.props.preferredLocale && !browser) {
		setLocale(data.props.preferredLocale);
	}
</script>

<h1>{data.props.preferredLocale}</h1>
<slot />
