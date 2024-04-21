<script lang="ts">
	import { onMount } from 'svelte';
	import { Renderer, setOptions, parse } from 'marked';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/a11y-dark.css'; // Stylish dark theme for code blocks

	export let message: any;
	export let name: string;
	export let profilePicture: string;

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
	window.copyToClipboard = function (encodedCode, buttonId) {
		const decodedCode = decodeURIComponent(escape(atob(encodedCode))); // Decode the Base64 string
		const button = document.getElementById(buttonId);
		navigator.clipboard.writeText(decodedCode).then(() => {
			if (button) {
				button.innerText = 'Copied!'; // Change button text to "Copied"
				setTimeout(() => {
					button.innerText = 'Copy code'; // Revert button text after 1 second
				}, 2000);
			}
		});
	};
	renderer.code = (code, language) => {
		const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
		const encodedCode = btoa(unescape(encodeURIComponent(code)));
		const buttonId = `copy-btn-${Math.random()}`;

		return `<div class="relative group min-w-2xl max-w-2xl">
					<div class="bg-zinc-700 rounded-t-xl p-1 flex justify-between">
						<div class="px-2 py-1 text-white text-xs">${validLanguage}</div>
						<button id="${buttonId}" class='px-2 py-1 text-white text-xs' onclick='copyToClipboard("${encodedCode}", "${buttonId}")'}>Copy code</button>
					</div>
                    <pre class="rounded-xl rounded-t-none overflow-x-auto border border-t-0 border-gray-500 min-w-2xl max-w-2xl"><code class="hljs ${validLanguage} block p-4">${hljs.highlight(code, { language: validLanguage, ignoreIllegals: true }).value}</code></pre>
                </div>`;
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
	<img class="h-10 w-10 rounded-full object-cover" src={profilePicture} alt={`Image of ${name}`} />
	<div>
		<div class="text-white font-bold text-sm">{name}</div>

		<div class="text-white text-sm space-y-3">
			{#if message?.data?.imageUrl}
				<img class="mt-3" src={message.data.imageUrl} />
			{/if}
			{@html formattedMessage}
		</div>
	</div>
</div>
