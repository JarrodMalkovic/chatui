<script lang="ts">
	import { user } from '$lib/auth';
	import { supabase } from '$lib/supabaseClient';
	import { writable } from 'svelte/store';
	import { Drawer } from 'flowbite-svelte';
	import { sineIn } from 'svelte/easing';
	import MdSearch from 'svelte-icons/md/MdSearch.svelte';
	import { PaginationItem } from 'flowbite-svelte';
	import { tick } from 'svelte';

	let messagesSearchTerm = writable('');
	let messagesSearchResult = writable([]);
	let isSearchDrawerHidden = true;
	let currentPage = writable(1);
	let totalPages = writable(0);
	let totalResults = writable(null);
	let loading = writable(false);
	let hasSearched = writable(false);
	let searchInput = null;

	async function fetchHighlightedMessages(searchTerm: string, pageNumber = 1, pageSize = 10) {
		loading.set(true);
		hasSearched.set(true);
		const pageOffset = (pageNumber - 1) * pageSize;
		const { data, error } = await supabase.rpc('search_messages', {
			term: searchTerm,
			page_limit: pageSize,
			page_offset: pageOffset
		});

		if (error) {
			console.error('Error fetching highlighted messages:', error);
			return { data: [], error };
		}

		// Set the total number of pages
		totalResults.set(data[0]?.total_count ?? 0);
		totalPages.set(Math.ceil(data[0]?.total_count / pageSize));
		loading.set(false);

		return messagesSearchResult.set(data);
	}

	function debounce(func, wait) {
		let timeout;
		return function (...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	const fetchDebounced = debounce(fetchHighlightedMessages, 500);

	messagesSearchTerm.subscribe(($messagesSearchTerm) => {
		if ($messagesSearchTerm.trim() !== '') {
			fetchDebounced($messagesSearchTerm, 1, 10);
		} else {
			messagesSearchTerm.set('');
			messagesSearchResult.set([]);
			currentPage.set(1);
			totalPages.set(0);
			totalResults.set(null);
			hasSearched.set(false);
		}
	});

	async function handleOpenSearchDrawer() {
		isSearchDrawerHidden = false;
		await tick();
		searchInput.focus();
	}

	function previous() {
		currentPage.set($currentPage - 1);
		fetchDebounced($messagesSearchTerm, $currentPage, 10);
	}

	function next() {
		currentPage.set($currentPage + 1);
		fetchDebounced($messagesSearchTerm, $currentPage, 10);
	}

	$: if (isSearchDrawerHidden) {
		messagesSearchTerm.set('');
		messagesSearchResult.set([]);
		currentPage.set(1);
		totalPages.set(0);
		totalResults.set(null);
		hasSearched.set(false);
	}
</script>

<div class="text-white font-bold min-h-full items-center flex pr-2">
	<button
		on:click={handleOpenSearchDrawer}
		class="w-10 h-10 hover:bg-zinc-700 p-2 rounded-lg border-zinc-800 border"><MdSearch /></button
	>
</div>
<Drawer
	bgColor="bg-zinc-950"
	bgOpacity="bg-opacity-45"
	divClass="z-50"
	class="bg-zinc-900 border-l border-zinc-700 m-0"
	placement="right"
	transitionType="fly"
	transitionParams={{
		x: 320,
		duration: 200,
		easing: sineIn
	}}
	bind:hidden={isSearchDrawerHidden}
>
	<div class="border-b border-zinc-700 p-2.5 px-4 h-[57px] flex items-center sticky absolute top-0">
		<input
			bind:this={searchInput}
			on:input={(e) => messagesSearchTerm.set(e.target.value)}
			disabled={!$user}
			placeholder="Search messages..."
			class="w-full rounded-lg bg-zinc-700 border-zinc-600 text-white text-sm focus:outline-0 focus-visible:ring-0 focus:border-zinc-500 {!$user
				? 'opacity-50 cursor-not-allowed'
				: ''}"
		/>
	</div>
	{#if !$user}
		<div
			class="flex justify-center items-center min-h-[calc(100vh-150px)] px-4 text-center text-sm"
		>
			<h2 class="text-white text-md">You must be logged in to search your messsages.</h2>
		</div>
	{:else if $hasSearched && $totalResults === 0}
		<div class="flex justify-center items-center min-h-[calc(100vh-150px)] px-4 text-center">
			<h2 class="text-white text-sm">No results found.</h2>
		</div>
	{:else if !$hasSearched}
		<div
			class="flex justify-center items-center min-h-[calc(100vh-150px)] px-4 text-center text-sm"
		>
			<h2 class="text-white text-md">Start typing to search for messages.</h2>
		</div>
	{/if}
	{#if $totalResults || $loading}
		<div
			class="bg-zinc-950 bg-opacity-50 border-b border-zinc-700 py-2 bg-zinc-0 flex items-center px-4 text-sm justify-between text-white"
		>
			{#if $loading}
				<h1 class="text-sm">Searching...</h1>
			{:else}
				<h1 class="text-sm">{$totalResults} Results</h1>
			{/if}
		</div>
	{/if}
	<div
		class="space-y-4 flex flex-col p-4 overflow-y-auto min-h-[calc(100vh-150px)] max-h-[calc(100vh-150px)]"
	>
		{#if !$loading}
			{#each $messagesSearchResult as messageSearchResult}
				<a href="/{messageSearchResult?.conversation_id}">
					<div class="bg-zinc-800 p-3 rounded-lg flex space-x-3">
						<img
							class="h-8 w-8 rounded-full"
							src={messageSearchResult?.role === 'user'
								? $user?.profilePicture
								: './assets/ai-profile-picture.webp'}
						/>
						<div>
							<h4 class="text-white text-sm">
								{messageSearchResult?.conversation_title ?? 'New Chat'}
							</h4>
							<p class="text-white text-sm highlight">
								{@html messageSearchResult?.highlighted_content}
							</p>
							{#if messageSearchResult.image_url}
								<img class="w-full h-fit mt-1" src={messageSearchResult.image_url} />
							{/if}
						</div>
					</div></a
				>
			{/each}
		{/if}
	</div>
	{#if $totalResults && !$loading}
		<div class="sticky bottom-0 bg-zinc-950 bg-opacity-50 border-t border-zinc-700 px-4 py-3">
			<div class="flex justify-center space-x-3 rtl:space-x-reverse">
				<PaginationItem
					class="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white  {$currentPage <=
					1
						? 'opacity-50 cursor-not-allowed'
						: ''}"
					on:click={() => ($currentPage <= 1 ? null : previous())}>Previous</PaginationItem
				>
				<PaginationItem
					class="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white  {$currentPage >=
					$totalPages
						? 'opacity-50 cursor-not-allowed'
						: ''}"
					on:click={() => ($currentPage >= $totalPages ? null : next())}>Next</PaginationItem
				>
			</div>
		</div>
	{/if}
</Drawer>

<style>
	:global(.highlight b) {
		background-color: yellow;
		@apply text-zinc-700 font-normal;
	}
</style>
