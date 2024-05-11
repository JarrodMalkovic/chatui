<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Renderer, setOptions, parse } from 'marked';
	import GoPlay from 'svelte-icons/go/GoPlay.svelte';
	import FaRegClipboard from 'svelte-icons/fa/FaRegClipboard.svelte';
	import FaPause from 'svelte-icons/fa/FaPause.svelte';
	import TiTick from 'svelte-icons/ti/TiTick.svelte';
	import MdClose from 'svelte-icons/md/MdClose.svelte';
	import hljs from 'highlight.js';
	import 'highlight.js/styles/a11y-dark.css'; // Stylish dark theme for code blocks
	import { Tooltip } from 'flowbite-svelte';
	import { Spinner } from 'flowbite-svelte';
	import { BootstrapToast, toasts } from 'svelte-toasts';

	export let message: any;
	export let name: string;
	export let profilePicture: string;
	export let isLastMessage = false;

	let formattedMessage = '';
	let audio = new Audio();
	let playing = false;
	let loading = false;
	let isOverlayVisible = false;

	const handleAudioPlayPause = () => {
		if (audio.src) {
			if (!audio.paused) {
				audio.pause();
				playing = false;
			} else {
				audio.play();
				playing = true;
			}
		}
	};
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
		return `<p>${text}</p>`;
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
		return `<${type} class="list-decimal ml-5 mt-2 mb-2 space-y-2" ${startAttr}>${body}</${type}>`;
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

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);

		if (audio) {
			audio.pause();
			audio.src = '';
		}
	});

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			isOverlayVisible = false;
		}
	}

	function handleSpeakMessageClick(): void {
		if (audio.src) {
			audio.play();
			playing = true;
			return;
		}

		loading = true;
		fetch('/api/voice', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: message.content })
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}

				return response.blob();
			})
			.then((blob) => {
				const url = URL.createObjectURL(blob);
				audio.src = url;
				audio.play();
				playing = true;
				loading = false;
			})
			.catch((error) => {
				toasts.add({
					placement: window.innerWidth > 768 ? 'top-right' : 'top-center',
					type: 'error',
					description: 'Error generating audio',
					component: BootstrapToast
				});
				loading = false;
			});
	}

	let showTick = false;
	function handleCopyToKeyboardClick(): void {
		navigator.clipboard.writeText(message.content).then(() => {
			showTick = true;
			setTimeout(() => {
				showTick = false;
			}, 2000);
		});
	}

	audio.addEventListener('ended', () => {
		playing = false;
	});

	onMount(async () => {
		window.addEventListener('keydown', handleKeyDown);

		if (message.content) {
			formattedMessage = parse(message.content);
		}
	});

	$: if (message.content) {
		formattedMessage = parse(message.content);
	}
</script>

<div class="flex space-x-2 group mb-4">
	<img class="h-10 w-10 rounded-full object-cover" src={profilePicture} alt={`Image of ${name}`} />
	<div>
		<div class="text-white font-bold text-sm">{name}</div>
		<div class="text-white text-sm space-y-3">
			{#if message?.data?.imageUrl}
				<img
					class="mt-3 cursor-pointer w-96"
					src={message.data.imageUrl}
					alt="Message image"
					on:click={() => (isOverlayVisible = true)}
				/>
			{/if}
			{@html formattedMessage}
		</div>

		<div
			class="mt-2 space-x-1.5 flex items-center {isLastMessage && !message.tool_calls
				? ''
				: 'invisible group-hover:visible'}"
		>
			{#if loading}
				<svg
					class="animate-spin h-4 w-4 text-white"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			{:else if playing}
				<button
					id="pause-audio-button"
					class="w-4 h-4 text-zinc-300"
					on:click={handleAudioPlayPause}
				>
					<FaPause />
				</button>
			{:else}
				<button
					id="play-audio-button"
					class="w-4 h-4 text-zinc-300"
					on:click={handleSpeakMessageClick}
				>
					<GoPlay />
				</button>
			{/if}
			<button
				id="copy-to-clipboard-button"
				type="button"
				class="w-4 h-4 text-zinc-300"
				on:click={handleCopyToKeyboardClick}
			>
				{#if showTick}
					<TiTick />
				{:else}
					<FaRegClipboard />
				{/if}
			</button>
		</div>
	</div>
</div>

{#if isOverlayVisible}
	<div
		class="fixed top-0 left-0 w-full h-full bg-black bg-opacity-75 flex items-center justify-center z-50"
		on:click={(event) => {
			if (event.target === event.currentTarget) isOverlayVisible = false;
		}}
	>
		<button
			on:click={() => {
				isOverlayVisible = false;
			}}
			aria-label="Close"
		>
			<div class="w-5 h-5">
				<MdClose />
			</div>
		</button>
		<img src={message.data.imageUrl} class="max-w-full max-h-full" alt="Full size image" />
	</div>
{/if}
