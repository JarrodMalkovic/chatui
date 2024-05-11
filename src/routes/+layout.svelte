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
	}

	$: if (browser) {
		setLocale(document.documentElement.lang ?? 'en');
	} else {
		setLocale(data.props.preferredLocale ?? 'en');
	}
</script>

<slot />

<style>
	:global(html),
	:global(body) {
		height: 100%;
		margin: 0;
	}
	:global(#svelte) {
		height: 100%;
	}
</style>
