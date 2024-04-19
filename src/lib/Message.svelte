<script lang="ts">
	import { onMount } from 'svelte';
	import { Renderer, setOptions, parse } from 'marked';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/a11y-dark.css'; // Stylish dark theme for code blocks

	export let message: any;
	export let name: string;
	export let imageUrl: string;

	let formattedMessage = '';

	const renderer = new Renderer();

	// Header with bold based on level
	renderer.heading = (text, level) => {
		const sizes = [
			'text-3xl font-bold',
			'text-2xl font-bold',
			'text-xl font-bold',
			'text-lg font-bold',
			'text-base font-bold',
			'text-sm font-bold'
		];
		return `<h${level} class="${sizes[level - 1]} mt-2 mb-2">${text}</h${level}>`;
	};

	// Paragraphs
	renderer.paragraph = (text) => {
		return `<p class="mb-4">${text}</p>`;
	};

	// Code blocks with syntax highlighting
	renderer.code = (code, language) => {
		const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
		return `<pre class="rounded-2xl"><code class="hljs ${validLanguage} rounded-2xl">${hljs.highlight(code, { language: validLanguage, ignoreIllegals: true }).value}</code></pre>`;
	};

	// Lists
	renderer.list = (body, ordered, start) => {
		const type = ordered ? 'ol' : 'ul';
		const startAttr = ordered && start !== 1 ? ` start="${start}"` : '';
		return `<${type} class="list-decimal ml-5 mt-2 mb-2" ${startAttr}>${body}</${type}>`;
	};

	// List items
	renderer.listitem = (text) => {
		return `<li class="mb-1">${text}</li>`;
	};

	// Bold text
	renderer.strong = (text) => {
		return `<strong class="font-bold">${text}</strong>`;
	};

	// Italic text
	renderer.em = (text) => {
		return `<em class="italic">${text}</em>`;
	};

	setOptions({
		renderer: renderer,
		pedantic: false,
		gfm: true,
		breaks: true
	});

	onMount(async () => {
		if (message.content) {
			formattedMessage = parse(message.content);
		}
	});

	$: if (message.content) {
		formattedMessage = parse(message.content);
	}
</script>

<div class="flex space-x-2">
	<img class="h-10 w-10 rounded-full object-cover" src={imageUrl} alt={`Image of ${name}`} />
	<div>
		<div class="text-white font-bold text-sm">{name}</div>
		<div class="text-white text-sm space-y-3">{@html formattedMessage}</div>
	</div>
</div>
