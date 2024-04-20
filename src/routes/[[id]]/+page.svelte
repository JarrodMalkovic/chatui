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
	import GoKebabHorizontal from 'svelte-icons/go/GoKebabHorizontal.svelte';

	let conversations = writable<any[]>([]);
	const {
		input,
		handleSubmit: makeAiRequest,
		messages,
		setMessages
	} = useChat({
		onFinish: async (message) => {
			createMessage(message.content, parseInt($page.params.id), 'assistant');

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
						currentConversation.id === parseInt($page.params.id)
							? { ...currentConversation, title: titleResponse.title }
							: currentConversation
					);
				});

				await supabase
					.from('conversations')
					.update({ title: titleResponse.title })
					.eq('id', parseInt($page.params.id));
			}
		}
	});

	async function handleSubmit(e) {
		if ($input.trim() === '') {
			return;
		}

		let conversationId = $page.params.id == null ? null : parseInt($page.params.id);
		let message = $input;
		makeAiRequest(e);

		if (conversationId == null && $user) {
			conversationId = await createConversation();
			goto(`/${conversationId}`);
		}

		createMessage(message, conversationId, 'user');
	}

	async function fetchConversations() {
		const { data, error } = await supabase
			.from('conversations')
			.select('*')
			.order('created_at', { ascending: false });

		if (!error) {
			conversations.set(data);
		} else {
			conversations.set([]);
		}
	}

	async function createConversation() {
		console.log($user);
		if (!$user) {
			return;
		}

		const { data, error } = await supabase
			.from('conversations')
			.insert({ user_id: $user.id })
			.select('*');

		if (data && data.length > 0) {
			conversations.update((currentConversations) => {
				return [data[0], ...currentConversations];
			});
			goto(`/${data[0].id}`);

			return data[0].id;
		} else {
			console.error('No data returned from the insert operation');
			return null;
		}
	}

	async function fetchMessages(conversationId: number) {
		const { data, error } = await supabase
			.from('messages')
			.select('*')
			.eq('conversation_id', conversationId)
			.order('created_at', { ascending: true });

		if (error) {
			console.error('Error fetching messages:', error);
		} else if (data) {
			setMessages(
				data.map((message) => ({
					id: message.id.toString(), // ensure the id is converted to string
					content: message.content,
					role: message.role
				}))
			);
		}
	}

	async function createMessage(message: string, conversationId: number, role: string) {
		if (!$user) {
			return;
		}

		await supabase
			.from('messages')
			.insert({ conversation_id: conversationId, content: message, role })
			.select('*');
	}

	async function deleteConversation(conversationId: number) {
		if (!$user) {
			return;
		}

		if ($page.params.id == conversationId) {
			goto('/');
		}

		await supabase.from('conversations').delete().eq('id', conversationId);

		conversations.update((conversations) =>
			conversations.filter((conversation) => conversation.id !== conversationId)
		);
	}

	let container: HTMLElement;
	async function scrollToBottom(force = false) {
		await tick();

		if (!container) return;

		// Check if the user is near the bottom of the container
		const isScrolledToBottom =
			container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

		if (isScrolledToBottom || force) {
			container.scrollTop = container.scrollHeight - container.clientHeight;
		}
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
			// Trigger on Enter unless Shift is also pressed
			event.preventDefault(); // Prevent default Enter behavior (new line)
			handleSubmit(event);
		}
	}

	onMount(async () => {
		fetchConversations();
		autoGrow();

		if ($page.params.id) {
			fetchMessages(parseInt($page.params.id));
		}

		scrollToBottom(true);
	});

	$: $page.params.id,
		$page.params.id == null ? setMessages([]) : fetchMessages(parseInt($page.params.id));
	$: $user, fetchConversations();
	$: $messages, scrollToBottom();
</script>

<div class="flex bg-zinc-900">
	<div class="flex flex-col w-72 pb-4 pl-4 pr-0.5 h-screen bg-zinc-950 justify-end text-white">
		<div class="flex-1 overflow-y-auto space-y-3 px-2 pr-4 relative overflow-x-visible">
			<a
				class="flex justify-between items-center mt-4 text-white pl-2 py-2 block text-xs hover:bg-zinc-800 w-full rounded-lg text-left font-bold"
				href="/"
				>Start new conversation
				<div class="w-4 h-4 mr-2">
					<MdCreate />
				</div>
			</a>

			{#each Object.entries($groupedConversations) as [period, convos]}
				{#if convos.length > 0}
					<div>
						<h1 class="text-xs p-2 py-2 font-bold text-zinc-400">{period}</h1>
						{#each convos as conversation}
							<div
								class="group flex pr-2 justify-between items-center block text-xs hover:bg-zinc-800 w-full rounded-lg {conversation.id ==
								$page.params.id
									? 'bg-zinc-900'
									: ''}"
							>
								<a
									class="text-white pl-2 py-2 text-left truncate w-full h-full"
									href="/{conversation.id}">{conversation.title ?? 'New chat'}</a
								>
								<div class="dropdown dropdown-end relative">
									<div
										tabindex="0"
										role="button"
										class="relative group-hover:opacity-100 max-h-4 max-w-4 hover:text-zinc-400 {conversation.id ==
										$page.params.id
											? 'opacity-100'
											: 'opacity-0'}"
									>
										<GoKebabHorizontal />
									</div>
									<ul
										tabindex="0"
										class="dropdown-content bg-zinc-800 border-zinc-500 border menu z-[999] p-2 shadow rounded-box w-52"
									>
										<li>
											<button on:click={() => deleteConversation(conversation.id)}>Delete</button>
										</li>
									</ul>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>

		{#if $user}
			<div class="dropdown dropdown-top">
				<div
					tabindex="0"
					role="button"
					class="mt-2 hover:bg-zinc-800 p-2 flex space-x-4 rounded-lg"
				>
					<img class="h-10 w-10 rounded-full" src={$user.profilePicture} />
					<div class="text-left">
						<h1 class="text-zinc-400 text-sm">Logged in as</h1>
						<h2>{$user.username}</h2>
					</div>
				</div>
				<ul
					tabindex="0"
					class="dropdown-content z-[1] border border-zinc-700 menu p-2 shadow bg-zinc-800 rounded-box w-full"
				>
					<li><button on:click={logOut}>Logout </button></li>
				</ul>
			</div>
		{:else}
			<div class="pr-4">
				<div class="space-y-2">
					<h1 class="font-bold text-sm">Sign up or log in</h1>
					<p class="text-zinc-400 text-sm">
						Save your chat history, share chats, and personalize your experience.
					</p>
				</div>
				<div class="mt-4 space-y-2">
					<a href="/signup" class="block">
						<button
							class="w-full p-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold text-sm"
							>Sign up</button
						>
					</a>
					<a href="/signin" class="block">
						<button
							class="w-full p-2 bg-zinc-900 hover:bg-zinc-800 border-zinc-800 border-2 border-solid rounded-lg font-bold text-sm"
						>
							Log in
						</button>
					</a>
				</div>
			</div>
		{/if}
	</div>
	<div class="w-full overflow-y-auto">
		<main class="container max-w-3xl mx-auto h-screen flex flex-col">
			{#if !$messages.length}
				<div class="h-full flex items-center justify-center">
					<div>
						<img class="mx-auto h-10 w-auto" src="./assets/logo.svg" alt="Your Company" />
						<h1 class="text-white text-xl font-bold mt-2">How can I help you today?</h1>
					</div>
				</div>
			{:else}
				<div bind:this={container} class="flex-1 p-4">
					<div class="space-y-4">
						{#each $messages as message}
							{#if message.role === 'user'}
								<Message
									{message}
									name={'You'}
									imageUrl={$user ? $user.profilePicture : './assets/default-profile-picture.webp'}
								/>
							{:else}
								<Message {message} name={'AI'} imageUrl={'./assets/ai-profile-picture.webp'} />
							{/if}
						{/each}
					</div>
				</div>
			{/if}

			<form on:submit={handleSubmit} class="pt-4 px-4 flex">
				<div class="p-2 flex w-full">
					<textarea
						bind:value={$input}
						bind:this={textarea}
						on:input={autoGrow}
						on:keydown={handleKeyDown}
						rows="1"
						placeholder="Message AI..."
						class="focus:border-zinc-600 border border-r-0 input rounded-r-none flex-grow outline-none bg-zinc-800 ring-0 focus-visible:ring-0 visible:ring-0 text-white transition-all resize-none focus:outline-none overflow-hidden"
					/>
					<button
						type="submit"
						class="button bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 text-sm px-4 rounded-r-lg"
					>
						Send
					</button>
				</div>
			</form>
			<p class="text-xs text-zinc-400 px-6 pb-4 text-center">
				This is an unofficial open source UI for the OpenAI API.
			</p>
		</main>
	</div>
</div>
