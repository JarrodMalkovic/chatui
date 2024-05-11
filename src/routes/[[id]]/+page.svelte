<script lang="ts">
	import { goto } from '$app/navigation';
	import { useChat } from 'ai/svelte';
	import Message from '../../components/Message.svelte';
	import { user } from '$lib/auth';
	import { supabase } from '$lib/supabaseClient';
	import { onMount, tick } from 'svelte';
	import { derived, writable } from 'svelte/store';
	import { page } from '$app/stores';
	import MdCreate from 'svelte-icons/md/MdCreate.svelte';
	import FaArrowDown from 'svelte-icons/fa/FaArrowDown.svelte';
	import { fly } from 'svelte/transition';
	import MdSend from 'svelte-icons/md/MdSend.svelte';
	import MdChevronLeft from 'svelte-icons/md/MdChevronLeft.svelte';
	import MdChevronRight from 'svelte-icons/md/MdChevronRight.svelte';
	import { Dropdown, Modal } from 'flowbite-svelte';
	import FaPause from 'svelte-icons/fa/FaPause.svelte';
	import { sineIn } from 'svelte/easing';
	import SearchMessagesSidebar from '../../components/SearchMessagesSidebar.svelte';
	import ConversationTitle from '../../components/ConversationTitle.svelte';
	import { Drawer } from 'flowbite-svelte';
	import { toasts, ToastContainer, BootstrapToast } from 'svelte-toasts';
	import { t } from 'svelte-i18n-lingui';

	let logoutDropdownOpen = false;
	let isSidebarVisible = null;
	let isSidebarHidden = true;
	let currentConversation = null;
	let previousId = null;
	let conversationPage = 1;
	const pageSize = 50;
	let isFetching = writable(false);
	let hasFetchedAllConversations = writable(false);
	let mobileSidebarContainer = null;
	let desktopSidebarContainer = null;

	function toggleSidebar() {
		setTimeout(() => {
			if (mobileSidebarContainer) {
				mobileSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);
		setTimeout(() => {
			if (desktopSidebarContainer) {
				desktopSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);

		isSidebarVisible = !isSidebarVisible;
		isSidebarHidden = !isSidebarHidden;
	}

	let isGenerating = false;
	let conversations = writable<any[]>([]);
	const { input, messages, append, setMessages, stop } = useChat({
		sendExtraMessageFields: true,
		onError: async () =>
			toasts.add({
				placement: window.innerWidth > 768 ? 'top-right' : 'top-center',
				type: 'error',
				description: 'Error generating response.',
				component: BootstrapToast
			}),
		onFinish: async (message) => {
			isGenerating = false;
			createMessage(message.content, $page.params.id, 'assistant');

			if (
				$messages.filter((message) => !message.tool_calls && message.role !== 'tool').length == 2
			) {
				const response = await fetch('/api/generate-title', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ initialMessage: $messages[0].content })
				});
				const titleResponse = await response.json();

				conversations.update((currentConversations) => {
					return currentConversations.map((currentConversation) =>
						currentConversation.id === $page.params.id
							? { ...currentConversation, title: titleResponse.title }
							: currentConversation
					);
				});

				await supabase
					.from('conversations')
					.update({ title: titleResponse.title })
					.eq('id', $page.params.id);
			}
		}
	});

	async function handleStopClick() {
		stop();
		isGenerating = false;
		createMessage($messages[$messages.length - 1].content, $page.params.id, 'assistant');

		if ($messages.length == 2) {
			const response = await fetch('/api/generate-title', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ initialMessage: $messages[0].content })
			});
			const titleResponse = await response.json();

			conversations.update((currentConversations) => {
				return currentConversations.map((currentConversation) =>
					currentConversation.id === $page.params.id
						? { ...currentConversation, title: titleResponse.title }
						: currentConversation
				);
			});

			await supabase
				.from('conversations')
				.update({ title: titleResponse.title })
				.eq('id', $page.params.id);
		}
	}

	let confirmNewChatModal = false;
	async function handleNewChat() {
		if ($user) {
			if (window.innerWidth < 768) {
				toggleSidebar();
			}
			await goto('/');
		} else if ($messages.length > 0) {
			confirmNewChatModal = true;
		}
	}

	function confirmNewChat() {
		if (window.innerWidth < 768) {
			toggleSidebar();
		}

		setMessages([]);
		if (isGenerating) {
			stop();
			isGenerating = false;
		}

		confirmNewChatModal = false;
	}

	async function handleSubmit(e = null) {
		e?.preventDefault();
		if ($input.trim() === '') {
			return;
		}

		let conversationId = $page.params.id == null ? null : $page.params.id;
		let message = $input;
		isGenerating = true;

		append({
			content: message,
			role: 'user'
		});
		input.set('');
		autoGrow();
		if (conversationId == null && $user) {
			conversationId = await createConversation();
			goto(`/${conversationId}`);
		}

		createMessage(message, conversationId, 'user');
	}

	function handleSuggestionClick(suggestedMessage: string) {
		$input = suggestedMessage;
		handleSubmit();
	}

	async function fetchMoreConversations() {
		if ($isFetching || $hasFetchedAllConversations) {
			return;
		}

		isFetching.set(true);
		const { data, error } = await supabase
			.from('conversations')
			.select(
				`
            id,
            title,
            created_at,
            models (
                id,
                name,
                internal_name
            )
        `
			)
			.order('created_at', { ascending: false })
			.range((conversationPage - 1) * pageSize, conversationPage * pageSize - 1);

		if (data?.length === 0) {
			hasFetchedAllConversations.set(true);
			return;
		}

		if (error) {
			console.error('Error fetching conversations:', error);
			return;
		}

		conversations.update((current) => [...current, ...data]);

		conversationPage++;
		isFetching.set(false);
	}

	async function handleSidebarScroll(event) {
		const { target } = event;

		if (!$isFetching && target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
			await fetchMoreConversations();
		}
	}

	async function createConversation() {
		if (!$user) {
			return;
		}

		const { data, error } = await supabase
			.from('conversations')
			.insert({ user_id: $user.id })
			.select('*');

		if (data && data.length > 0) {
			const conversation = data[0];
			conversations.update((currentConversations) => {
				return [data[0], ...currentConversations];
			});
			goto(`/${conversation.id}`);

			return conversation.id;
		} else {
			console.error('No data returned from the insert operation');
			return null;
		}
	}

	async function fetchMessages(conversationId: string) {
		const { data, error } = await supabase
			.from('messages')
			.select('*')
			.eq('conversation_id', conversationId)
			.order('created_at', { ascending: true });

		if (error) {
			toasts.add({
				placement: window.innerWidth > 768 ? 'top-right' : 'top-center',
				type: 'error',
				description: 'Error loading messages for this conversation.',
				component: BootstrapToast
			});
			return;
		}

		if (data) {
			setMessages(
				data.map((message) => ({
					id: message.id.toString(),
					content: message.content,
					role: message.role,
					data: {
						imageUrl: message.image_url
					}
				}))
			);
		}
	}

	async function createMessage(message: string, conversationId: string, role: string) {
		if (!$user) {
			return;
		}

		await supabase
			.from('messages')
			.insert({ conversation_id: conversationId, content: message, role })
			.select('*');
	}

	let container: HTMLElement;
	async function scrollToBottom(force = true) {
		if (!container) return;

		const isScrolledToBottom =
			container.scrollHeight - container.offsetHeight <= container.clientHeight + 100;

		if (isScrolledToBottom || force) {
			container.scrollTop = container.scrollHeight - container.clientHeight;
		}
	}

	let showScrollButton = false;
	function handleScroll() {
		const threshold = 100; // Threshold for when to show the button
		showScrollButton =
			container.scrollTop < container.scrollHeight - container.clientHeight - threshold;
	}

	function onScrollToBottomButtonClick() {
		container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
		showScrollButton = false;
	}

	async function logOut() {
		await supabase.auth.signOut();
		conversations.set([]);
		goto('/');
	}

	function groupConversations(conversations) {
		const groups = {
			Today: [],
			Yesterday: [],
			'Last 7 Days': [],
			'Last 30 Days': [],
			Older: []
		};

		const now = new Date();
		const today = now.setHours(0, 0, 0, 0);
		const yesterday = new Date(today).setDate(now.getDate() - 1);
		const last7Days = new Date(today).setDate(now.getDate() - 7);
		const last30Days = new Date(today).setDate(now.getDate() - 30);

		conversations.forEach((convo) => {
			const convoDate = new Date(convo.created_at).getTime();
			if (convoDate > today) {
				groups['Today'].push(convo);
			} else if (convoDate > yesterday) {
				groups['Yesterday'].push(convo);
			} else if (convoDate > last7Days) {
				groups['Last 7 Days'].push(convo);
			} else if (convoDate > last30Days) {
				groups['Last 30 Days'].push(convo);
			} else {
				groups['Older'].push(convo);
			}
		});
		return groups;
	}

	let groupedConversations = derived(conversations, ($conversations) =>
		groupConversations($conversations)
	);

	let textarea;
	function autoGrow() {
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	function handleKeyDown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit(event);
		}
	}

	function updateSidebarVisibility() {
		setTimeout(() => {
			if (mobileSidebarContainer) {
				mobileSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);
		setTimeout(() => {
			if (desktopSidebarContainer) {
				desktopSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);

		isSidebarVisible = window.innerWidth > 768;
		isSidebarHidden = !isSidebarVisible;
	}

	onMount(async () => {
		await tick();

		updateSidebarVisibility();
		window.addEventListener('resize', updateSidebarVisibility);
		container.addEventListener('scroll', handleScroll);
		autoGrow();
		setTimeout(() => {
			if (mobileSidebarContainer) {
				mobileSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);
		setTimeout(() => {
			if (desktopSidebarContainer) {
				desktopSidebarContainer.addEventListener('scroll', handleSidebarScroll);
			}
		}, 0);

		if ($page.params.id) {
			fetchMessages($page.params.id);
		}

		scrollToBottom(true);

		return () => {
			window.removeEventListener('resize', updateSidebarVisibility);
			container.addEventListener('scroll', handleScroll);
			if (mobileSidebarContainer) {
				mobileSidebarContainer.removeEventListener('scroll', handleSidebarScroll);
			}

			if (desktopSidebarContainer) {
				desktopSidebarContainer.removeEventListener('scroll', handleSidebarScroll);
			}
		};
	});

	function portal(node, target = document.body) {
		target.appendChild(node);
		return {
			destroy() {
				if (node.parentNode === target) {
					target.removeChild(node);
				}
			}
		};
	}

	$: if ($page.params.id !== previousId) {
		if (previousId != null) {
			if (isGenerating) {
				stop();
				isGenerating = false;
				createMessage($messages[$messages.length - 1].content, previousId, 'assistant');
			}
		}
		previousId = $page.params.id;
	}
	$: $page.params.id, $page.params.id == null ? setMessages([]) : fetchMessages($page.params.id);
	$: $page.params.id, (currentConversation = $conversations.find((c) => c.id === $page.params.id));
	$: $user, fetchMoreConversations();
	$: $messages, scrollToBottom();
</script>

<ToastContainer {toasts} let:data>
	<BootstrapToast {data} />
</ToastContainer>

<div
	class={confirmNewChatModal
		? 'absolute top-0 z-[999] bg-zinc-950 bg-opacity-70 w-screen h-dvh'
		: ''}
	use:portal
>
	<Modal
		bind:open={confirmNewChatModal}
		dismissable={false}
		outsideclose={true}
		size="xs"
		class="bg-zinc-800"
		backdropClass="fixed inset-0 z-40 bg-zinc-950 bg-opacity-70"
	>
		<div class="text-center space-x-2 text-white space-y-3">
			<h3 class="text-md font-bold">{$t`Start a new chat?`}</h3>
			<p class="text-sm">
				{$t`Your current chat will no longer be accessible. Please`}
				<a class="underline" href="/signup">{$t`sign up`}</a>
				{$t`or`}
				<a class="underline" href="/signin">{$t`log in`}</a>
				{$t`to save your chats.`}
			</p>
			<button
				class="text-sm border-2 p-2 rounded-lg bg-zinc-700 hover:bg-zinc-800 border-zinc-600 font-bold"
				on:click={() => (confirmNewChatModal = false)}>{$t`Cancel`}</button
			>
			<button
				class="text-sm p-2 rounded-lg border-2 border-pink-600 hover:border-pink-800 bg-pink-600 hover:bg-pink-800 font-bold"
				on:click={confirmNewChat}>{$t`New chat`}</button
			>
		</div>
	</Modal>
</div>

<div class="flex bg-zinc-900 relative">
	<button
		class="md:flex hidden absolute top-1/2 {isSidebarVisible
			? 'left-72'
			: 'left-0'} z-30 p-1 m-1 bg-zinc-900 rounded-full text-white hover:bg-zinc-800"
		on:click={toggleSidebar}
	>
		<div class="h-6 w-6">
			{#if isSidebarVisible}
				<MdChevronLeft />
			{:else}
				<MdChevronRight />
			{/if}
		</div>
	</button>

	<div
		class="transition-transform duration-300 transform bg-zinc-950 md:flex hidden {isSidebarVisible ==
		null
			? 'w-[341px]'
			: isSidebarVisible
				? 'translate-x-0'
				: '-translate-x-full'}"
		transition:fly={{ x: -320, duration: 200, easing: sineIn }}
	>
		{#if isSidebarVisible}
			<div class="flex flex-col w-72 pb-4 h-dvh bg-zinc-950 justify-end text-white">
				<div
					class="sticky top-0 z-10 bg-zinc-950 shadow-xl justify-between flex px-4 py-3 flex items-center h-[57px]"
				>
					<a
						class="flex items-center text-white pl-2 py-2 block hover:bg-zinc-800 w-full rounded-lg text-left font-bold"
						href="/"
						on:click|preventDefault={handleNewChat}
					>
						<div class="w-4 h-4 mr-2">
							<MdCreate />
						</div>
						{$t`New chat`}
					</a>
				</div>
				<div
					bind:this={desktopSidebarContainer}
					class="flex-1 overflow-y-auto space-y-3 px-2 pr-4 relative overflow-x-visible pl-4 pr-0.5 pt-1"
				>
					{#each Object.entries($groupedConversations) as [period, convos]}
						{#if convos.length > 0}
							<div>
								<h1 class="text-xs p-2 py-2 font-bold text-zinc-400">{period}</h1>
								{#each convos as conversation}
									<ConversationTitle
										isActive={conversation.id === $page.params.id}
										{conversation}
										{conversations}
									/>
								{/each}
							</div>
						{/if}
					{/each}
				</div>

				{#if $user}
					<div class="px-4">
						<div
							tabindex="0"
							role="button"
							class="mt-2 hover:bg-zinc-800 p-2 flex space-x-4 rounded-lg items-center {logoutDropdownOpen
								? 'bg-zinc-800'
								: ''}"
						>
							<img class="h-8 w-8 rounded-full" src={$user.profilePicture} />
							<div class="text-left">
								<h2 class="text-sm">{$user.username}</h2>
							</div>
						</div>
						<Dropdown
							bind:open={logoutDropdownOpen}
							placement="bottom-start"
							class="z-[9999] max-h-96 w-64 overflow-scroll space-y-3 "
							containerClass="bg-zinc-800 -mt-2 rounded-xl text-white border border-zinc-700 translate-y-2 transition-all duration-300 transform ease-in-out origin-center"
						>
							<div class="p-1">
								<button
									on:click={logOut}
									class="w-full text-left p-2 hover:bg-zinc-700 rounded-lg text-sm"
									>{$t`Logout`}
								</button>
							</div>
						</Dropdown>
					</div>
				{:else}
					<div class="px-4">
						<div class="space-y-2">
							<h1 class="font-bold text-sm">{$t`Sign up or log in`}</h1>
							<p class="text-zinc-400 text-sm">
								{$t`Preserve your chat history and customize your experience.`}
							</p>
						</div>
						<div class="mt-4 space-y-2">
							<a href="/signup" class="block">
								<button
									class="w-full p-2 bg-pink-600 hover:bg-pink-700 rounded-lg font-bold text-sm"
									>{$t`Sign up`}</button
								>
							</a>
							<a href="/signin" class="block">
								<button
									class="w-full p-2 bg-zinc-900 hover:bg-zinc-800 border-zinc-800 border-2 border-solid rounded-lg font-bold text-sm"
								>
									{$t`Log in`}
								</button>
							</a>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<Drawer
		bgColor="bg-zinc-950 md:hidden flex"
		bgOpacity="bg-opacity-45"
		divClass="z-50  md:hidden flex"
		class="bg-zinc-900 border-l border-zinc-700 m-0 md:hidden flex"
		placement="left"
		transitionType="fly"
		transitionParams={{
			x: -320,
			duration: 200,
			easing: sineIn
		}}
		bind:hidden={isSidebarHidden}
	>
		<div
			class="flex flex-col w-full pb-4 h-dvh bg-zinc-950 justify-end text-white border-r border-zinc-800"
		>
			<div
				class="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800 justify-between flex shadow-lg px-4 py-3 items-center h-[57px]"
			>
				<a
					class="flex items-center text-white pl-2 py-2 block hover:bg-zinc-800 w-full rounded-lg text-left font-bold"
					href="/"
					on:click|preventDefault={handleNewChat}
				>
					<div class="w-4 h-4 mr-2">
						<MdCreate />
					</div>
					{$t`New chat`}
				</a>
			</div>
			<div
				bind:this={mobileSidebarContainer}
				class="flex-1 overflow-y-auto space-y-3 px-2 pr-4 relative overflow-x-visible pl-4 pr-0.5 pt-1"
			>
				{#each Object.entries($groupedConversations) as [period, convos]}
					{#if convos.length > 0}
						<div>
							<h1 class="text-xs p-2 py-2 font-bold text-zinc-400">{period}</h1>
							{#each convos as conversation}
								<ConversationTitle
									isActive={conversation.id === $page.params.id}
									{conversation}
									{conversations}
								/>
							{/each}
						</div>
					{/if}
				{/each}
			</div>

			{#if $user}
				<div class="px-4">
					<div
						tabindex="0"
						role="button"
						class="mt-2 hover:bg-zinc-800 p-2 flex space-x-4 rounded-lg items-center {logoutDropdownOpen
							? 'bg-zinc-800'
							: ''}"
					>
						<img class="h-8 w-8 rounded-full" src={$user.profilePicture} />
						<div class="text-left">
							<h2 class="text-sm">{$user.username}</h2>
						</div>
					</div>
					<Dropdown
						bind:open={logoutDropdownOpen}
						placement="bottom-start"
						class="z-[9999] max-h-96 w-64 overflow-scroll space-y-3"
						containerClass="bg-zinc-800 rounded-xl text-white border border-zinc-700  mt-2.5"
					>
						<div class="p-1">
							<button
								on:click={logOut}
								class="w-full text-left p-2 hover:bg-zinc-700 rounded-lg text-sm"
							>
								{$t`Logout`}
							</button>
						</div>
					</Dropdown>
				</div>
			{:else}
				<div class="px-4">
					<div class="space-y-2">
						<h1 class="font-bold text-sm">{$t`Sign up or log in`}</h1>
						<p class="text-zinc-400 text-sm">
							{$t`Preserve your chat history and customize your experience.`}
						</p>
					</div>
					<div class="mt-4 space-y-2">
						<a href="/signup" class="block">
							<button class="w-full p-2 bg-pink-600 hover:bg-pink-700 rounded-lg font-bold text-sm">
								{$t`Sign up`}
							</button>
						</a>
						<a href="/signin" class="block">
							<button
								class="w-full p-2 bg-zinc-900 hover:bg-zinc-800 border-zinc-800 border-2 border-solid rounded-lg font-bold text-sm"
							>
								{$t`Log in`}
							</button>
						</a>
					</div>
				</div>
			{/if}
		</div>
	</Drawer>

	<div class="w-full">
		<div
			class="sticky top-0 z-10 bg-zinc-900 sm:border-0 border shadow-xl sm:shadow-none border-zinc-800 justify-between flex h-[57px]"
		>
			<div
				class="md:hidden flex absolute left-0 -top-0 text-white font-bold min-h-full items-center pl-2 pr-2"
			>
				<button
					class="w-10 h-10 hover:bg-zinc-700 p-2 rounded-lg border-zinc-800 border"
					on:click={toggleSidebar}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="2"
						stroke="currentColor"
						class="w-6 h-6 text-white"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
					</svg>
				</button>
			</div>

			<div class="flex-1 flex justify-center w-full">
				<div
					class="text-white text-sm max-w-3xl font-bold min-h-full text-center items-center flex mx-4"
				>
					{currentConversation
						? currentConversation.title
							? currentConversation.title
							: $t`New Chat`
						: ''}
				</div>
			</div>

			{#if isSidebarVisible == false}
				<div class="absolute left-2 top-2 hidden sm:block">
					<a class="" href="/" on:click|preventDefault={handleNewChat}>
						<div
							class="w-10 h-10 hover:bg-zinc-700 p-2 rounded-lg border-zinc-800 border text-white"
						>
							<MdCreate />
						</div>
					</a>
				</div>
			{/if}

			<div class="absolute right-0 top-2">
				<SearchMessagesSidebar />
			</div>
		</div>

		<div bind:this={container} class="w-full overflow-y-scroll">
			<main class="container max-w-3xl mx-auto flex flex-col h-[calc(100vh_-_57px)]">
				{#if !$messages.length && !isGenerating}
					<div class="flex flex-col h-full justify-between">
						<div class="h-full flex justify-center items-center">
							<div class="flex flex-col items-center mt-24 space-y-4">
								<img
									class="h-16 w-16 rounded-full border-2 border-zinc-700"
									src="./assets/ai-profile-picture.webp"
								/>
								<h1 class="text-white text-center text-xl font-bold">
									{$t`Ask me anything`}
								</h1>
							</div>
						</div>
						<div class="h-auto px-2">
							<div class="flex justify-center gap-4 mb-6 m-6">
								<button
									class="w-56 p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left overflow-x-hidden text-ellipsis bg-zinc-800 shadow-xl hover:-translate-y-2 transition-transform duration-300"
									on:click={() => handleSuggestionClick('Write a thank-you note to our babysitter')}
								>
									<img class="mb-2" src="./assets/babysitter-letter-suggestion.webp" />
									<h2 class="font-bold text-zinc-400 text-sm overflow-ellipsis truncate">
										{$t`Help`}
									</h2>
									<h3 class="font-bold text-md text-white">
										{$t`Write a thank-you note to our babysitter`}
									</h3>
								</button>

								<button
									class="md:block hidden w-56 p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left overflow-x-hidden text-ellipsis bg-zinc-800 shadow-xl hover:-translate-y-2 transition-transform duration-300"
									on:click={() => handleSuggestionClick('Simulate a mock interview')}
								>
									<img class="mb-2" src="./assets/mock-interview-suggestion.webp" />
									<h2 class="font-bold text-zinc-400 text-sm overflow-ellipsis truncate">
										{$t`Learn`}
									</h2>
									<h3 class="font-bold text-md text-white">
										{$t`Simulate a mock interview`}
									</h3>
								</button>

								<button
									class="lg:block hidden w-56 p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left overflow-x-hidden text-ellipsis bg-zinc-800 shadow-xl hover:-translate-y-2 transition-transform duration-300"
									on:click={() => handleSuggestionClick('Plan a trip to explore Madagascar')}
								>
									<img class="mb-2" src="./assets/explore-madagascar-suggestion.webp" />
									<h2 class="font-bold text-zinc-400 text-sm overflow-ellipsis truncate">
										{$t`Fun`}
									</h2>
									<h3 class="font-bold text-md text-white">
										{$t`Plan a trip to explore Madagascar`}
									</h3>
								</button>
							</div>
						</div>
					</div>
				{:else}
					<div class="flex-1 p-4">
						{#each $messages as message, index}
							{#if message.role === 'user'}
								<Message
									{message}
									name={$t`You`}
									isLastMessage={index === $messages.length - 1}
									profilePicture={$user
										? $user.profilePicture
										: './assets/default-profile-picture.webp'}
								/>
							{:else if message.role === 'assistant'}
								<Message
									{message}
									name={$t`AI`}
									isLastMessage={index === $messages.length - 1}
									profilePicture={'./assets/ai-profile-picture.webp'}
								/>
							{/if}
						{/each}
					</div>
				{/if}

				<div class="sticky bottom-0">
					{#if showScrollButton}
						<div class="flex justify-center">
							<button
								on:click={onScrollToBottomButtonClick}
								class="p-2 mb-2 w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-800 border-1 border-zinc-400 text-white"
								in:fly={{ y: 30, duration: 300 }}
							>
								<FaArrowDown />
							</button>
						</div>
					{/if}
					<div class="bg-zinc-900">
						<form on:submit={handleSubmit} class="px-4 flex">
							<div
								class="m-2 w-full border border-zinc-700 focus-within:border-zinc-600 focus-within:border rounded-lg bg-zinc-800"
							>
								<div class="flex">
									<textarea
										bind:value={$input}
										bind:this={textarea}
										on:input={autoGrow}
										on:keydown={handleKeyDown}
										rows="1"
										placeholder="Ask AI anything..."
										class="flex-grow outline-none ring-0 bg-inherit border-0 rounded-lg focus-visible:ring-0 visible:ring-0 text-white transition-all resize-none focus:outline-none overflow-hidden"
									/>
									{#if isGenerating}
										<button
											on:click={handleStopClick}
											class="button text-zinc-300 hover:text-white font-bold w-10 h-10 p-2 rounded-r-lg"
										>
											<FaPause />
										</button>{:else}
										<button
											type="submit"
											class="button text-zinc-300 hover:text-white font-bold w-10 h-10 p-2 rounded-r-lg"
										>
											<MdSend />
										</button>
									{/if}
								</div>
							</div>
						</form>
						<p class="text-xs text-zinc-400 px-6 pb-4 text-center">
							{$t`Messages are AI-generated and may contain inaccuracies or inappropriate content.`}
						</p>
					</div>
				</div>
			</main>
		</div>
	</div>
</div>
