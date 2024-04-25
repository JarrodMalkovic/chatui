<script lang="ts">
	import { goto } from '$app/navigation';
	import { useChat } from 'ai/svelte';
	import Message from '../../components/Message.svelte';
	import { user } from '$lib/auth';
	import { supabase, supabaseUrl } from '$lib/supabaseClient';
	import { onMount, tick } from 'svelte';
	import { derived, get, writable } from 'svelte/store';
	import { page } from '$app/stores';
	import MdCreate from 'svelte-icons/md/MdCreate.svelte';
	import GoKebabHorizontal from 'svelte-icons/go/GoKebabHorizontal.svelte';
	import FaArrowDown from 'svelte-icons/fa/FaArrowDown.svelte';
	import { fly } from 'svelte/transition';
	import MdAttachFile from 'svelte-icons/md/MdAttachFile.svelte';
	import MdWarning from 'svelte-icons/md/MdWarning.svelte';
	import MdSend from 'svelte-icons/md/MdSend.svelte';
	import MdChevronLeft from 'svelte-icons/md/MdChevronLeft.svelte';
	import MdChevronRight from 'svelte-icons/md/MdChevronRight.svelte';
	import MdClose from 'svelte-icons/md/MdClose.svelte';
	import GoChevronDown from 'svelte-icons/go/GoChevronDown.svelte';
	import { Button, Dropdown, DropdownItem, Modal } from 'flowbite-svelte';
	import FaPause from 'svelte-icons/fa/FaPause.svelte';

	let showModal = false;
	let conversationToDelete = null;
	let isSidebarVisible = true; // Default to visible

	function toggleSidebar() {
		isSidebarVisible = !isSidebarVisible;
	}

	let isGenerating = false;
	let conversations = writable<any[]>([]);
	const { input, messages, append, setMessages, stop } = useChat({
		sendExtraMessageFields: true,
		onError: async () => console.log('err'),
		onFinish: async (message) => {
			isGenerating = false;
			createMessage(message.content, $page.params.id, 'assistant');

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

	let selectedFile = writable(null);
	let imagePreviewUrl = null;
	let isUploading = writable(false); // to track upload state
	let uploadedImageUrl = writable(null); // to store the uploaded image URL

	function removeAttachment() {
		selectedFile.set(null);
		imagePreviewUrl = null;
		uploadedImageUrl.set(null);
		isUploading.set(false);
	}

	let confirmNewChatModal = false; // New state for the new chat confirmation modal
	function handleNewChat() {
		if ($user) {
			// User is logged in, navigate to home
			goto('/');
		} else if ($messages.length > 0) {
			// User is logged out, show confirmation modal
			confirmNewChatModal = true;
		}
	}

	// Function to confirm new chat from modal
	function confirmNewChat() {
		setMessages([]); // Clear messages
		confirmNewChatModal = false; // Close modal
	}

	function handleFileSelection(event) {
		const file = event.target.files[0];
		if (!file) return;

		// Update the selected file store
		selectedFile.set(file);
		// Generate a URL to preview the selected image
		imagePreviewUrl = URL.createObjectURL(file);

		// Start the upload immediately
		uploadFile(file);
	}

	async function uploadFile(file) {
		isUploading.set(true);
		const fileExt = file.name.split('.').pop();
		const fileName = `${Math.random().toString(36)}.${fileExt}`;

		let { data, error } = await supabase.storage.from('uploads').upload(fileName, file);

		isUploading.set(false);

		if (error) {
			console.error('Error uploading file:', error);
			return;
		}

		uploadedImageUrl.set(`${supabaseUrl}/storage/v1/object/public/${data?.fullPath}`);
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
			role: 'user',
			data: {
				imageUrl: $uploadedImageUrl, // use the URL from the uploaded image
				imagePreviewUrl
			}
		});
		imagePreviewUrl = null;
		input.set('');

		if (conversationId == null && $user) {
			conversationId = await createConversation();
			goto(`/${conversationId}`);
		}

		createMessage(message, conversationId, 'user', $uploadedImageUrl);
	}

	function handleSuggestionClick(suggestedMessage: string) {
		$input = suggestedMessage;
		handleSubmit();
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

	async function fetchMessages(conversationId: string) {
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

	async function createMessage(
		message: string,
		conversationId: string,
		role: string,
		imageUrl?: string
	) {
		if (!$user) {
			return;
		}

		await supabase
			.from('messages')
			.insert({ conversation_id: conversationId, content: message, role, image_url: imageUrl })
			.select('*');
	}

	function handleDeleteClick(conversationId) {
		conversationToDelete = conversationId;
		showModal = true;
	}

	async function confirmDelete() {
		showModal = false;
		if (conversationToDelete) {
			await deleteConversation(conversationToDelete);
			conversationToDelete = null;
		}
	}

	async function deleteConversation(conversationId: string) {
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

	let renameInput;
	let conversationToRename = null;
	function handleRenameClick(conversationId) {
		conversationToRename = conversationId;
		focusRenameInput();
	}

	async function focusRenameInput() {
		await tick(); // Ensure the DOM is updated
		if (renameInput) {
			renameInput.focus(); // Focus the input if it exists
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

	let dragActive = writable(false); // To track if a drag is active for visual feedback

	function handleDragOver(event) {
		event.preventDefault(); // Necessary to allow for dropping
		dragActive.set(true);
	}

	function handleDrop(event) {
		event.preventDefault();
		dragActive.set(false);
		const file = event.dataTransfer.files[0]; // Assuming only one file is dropped
		if (file) {
			selectedFile.set(file);
			imagePreviewUrl = URL.createObjectURL(file);
			uploadFile(file);
		}
	}

	function handleDragEnter(event) {
		event.preventDefault();
		dragActive.set(true);
	}

	function handleDragLeave(event) {
		event.preventDefault();
		if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
			dragActive.set(false);
		}
	}

	async function handleUpdateConversationTitle(event) {
		event.preventDefault();
		conversationToRename = null;

		if (event.target.value) {
			await supabase
				.from('conversations')
				.update({ title: event.target.value })
				.eq('id', conversationToRename);
			conversations.update((currentConversations) => {
				return currentConversations.map((currentConversation) =>
					currentConversation.id === conversationToRename
						? { ...currentConversation, title: event.target.value }
						: currentConversation
				);
			});
		}
	}

	onMount(async () => {
		container.addEventListener('scroll', handleScroll);
		fetchConversations();
		autoGrow();

		if ($page.params.id) {
			fetchMessages($page.params.id);
		}

		scrollToBottom(true);
	});

	$: $page.params.id, $page.params.id == null ? setMessages([]) : fetchMessages($page.params.id);
	$: $user, fetchConversations();
	$: $messages, scrollToBottom();
</script>

<div
	class="flex bg-zinc-900 relative"
	on:dragover|preventDefault={handleDragOver}
	on:drop|preventDefault={handleDrop}
	on:dragenter|preventDefault={handleDragEnter}
	on:dragleave|preventDefault={handleDragLeave}
	role="dialog"
	aria-label="Drop files here to upload"
	tabindex="0"
>
	{#if $dragActive}
		<div
			class="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
		>
			<p class="text-white font-bold text-lg">Drop file to upload</p>
		</div>
	{/if}

	<button
		class="absolute top-1/2 {isSidebarVisible
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

	<Modal
		bind:open={confirmNewChatModal}
		dismissable={false}
		outsideclose={true}
		size="xs"
		class="bg-zinc-800"
		backdropClass="fixed inset-0 z-40 bg-zinc-950 bg-opacity-70"
	>
		<div class="text-center space-x-2 text-white space-y-3">
			<h3 class="text-md font-bold">Start a new chat?</h3>
			<p class="text-sm">
				Your current chat will no longer be accessible. <a class="underline" href="/signup"
					>Sign up</a
				>
				or
				<a class="underline" href="/signin">log in</a> to save chats.
			</p>
			<button
				class="text-sm border p-2 rounded-xl border-zinc-500"
				on:click={() => (confirmNewChatModal = false)}>Cancel</button
			>
			<button
				class="text-sm p-2 rounded-xl bg-violet-600 hover:bg-violet-800"
				on:click={confirmNewChat}>New chat</button
			>
		</div>
	</Modal>

	<Modal
		bind:open={showModal}
		dismissable={false}
		outsideclose={true}
		size="xs"
		class="bg-zinc-800"
		backdropClass="fixed inset-0 z-40 bg-zinc-950 bg-opacity-70"
	>
		<div class="mx-auto mb-4 text-white w-12 h-12"><MdWarning /></div>
		<div class="text-center space-x-2 text-white">
			<h3 class="mb-5 text-md font-normal">Are you sure you want to delete this conversation?</h3>
			<button
				class="text-sm border p-2 rounded-xl border-zinc-500"
				on:click={() => (showModal = false)}>Cancel</button
			>
			<button class="text-sm p-2 rounded-xl bg-red-600 hover:bg-red-800" on:click={confirmDelete}
				>Delete</button
			>
		</div>
	</Modal>

	{#if isSidebarVisible}
		<div class="transition-transform duration-300 transform bg-zinc-950">
			<div class="flex flex-col w-72 pb-4 pl-4 pr-0.5 h-screen bg-zinc-950 justify-end text-white">
				<div class="flex-1 overflow-y-auto space-y-3 px-2 pr-4 relative overflow-x-visible">
					<a
						class="flex justify-between items-center mt-4 text-white pl-2 py-2 block text-xs hover:bg-zinc-800 w-full rounded-lg text-left font-bold"
						href="/"
						on:click|preventDefault={handleNewChat}
					>
						New chat
						<div class="w-4 h-4 mr-2">
							<MdCreate />
						</div>
					</a>

					{#each Object.entries($groupedConversations) as [period, convos]}
						{#if convos.length > 0}
							<div>
								<h1 class="text-xs p-2 py-2 font-bold text-zinc-400">{period}</h1>
								{#each convos as conversation}
									{#if conversation.id === conversationToRename}
										<input
											bind:this={renameInput}
											class="text-white px-2 py-2 bg-transparent rounded-lg w-full text-xs bg-zinc-800"
											value={conversation.title}
											on:focusout={handleUpdateConversationTitle}
										/>
									{:else}
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
														<button on:click={() => handleRenameClick(conversation.id)}>
															Rename
														</button>
													</li>
													<li>
														<button on:click={() => handleDeleteClick(conversation.id)}>
															Delete
														</button>
													</li>
												</ul>
											</div>
										</div>{/if}
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
							class="mt-2 hover:bg-zinc-800 p-2 flex space-x-4 rounded-lg items-center"
						>
							<img class="h-8 w-8 rounded-full" src={$user.profilePicture} />
							<div class="text-left">
								<h2 class="text-sm">{$user.username}</h2>
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
		</div>
	{/if}

	<div bind:this={container} class="w-full overflow-y-scroll">
		<div class="absolute m-2">
			<button class="flex items-center text-white p-2 hover:bg-zinc-800 rounded-xl font-semibold"
				>ChatGPT 4 <div class="w-4 h-4 ms-2 text-white"><GoChevronDown /></div></button
			>
			<Dropdown>
				<div>test</div>
				<DropdownItem>Dashboard</DropdownItem>
				<DropdownItem>Settings</DropdownItem>
				<DropdownItem>Earnings</DropdownItem>
				<DropdownItem>Sign out</DropdownItem>
			</Dropdown>
		</div>
		<main class="container max-w-3xl mx-auto h-screen flex flex-col">
			{#if !$messages.length}
				<div class="h-full flex items-center justify-center">
					<div>
						<img class="mx-auto h-10 w-auto" src="./assets/logo.svg" alt="Your Company" />
						<h1 class="text-white text-xl font-bold mt-2">How can I help you today?</h1>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4 mb-2 m-6">
					<button
						on:click={() =>
							handleSuggestionClick(
								'Write a thank-you note to our babysitter for the last-minute help'
							)}
						class="p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left overflow-x-hidden text-ellipsis"
					>
						<h2 class="font-bold text-white text-sm overflow-ellipsis truncate">
							Write a thank-you note
						</h2>
						<h3 class="text-sm overflow-ellipsis truncate">
							to our babysitter for the last-minute help
						</h3>
					</button>

					<button
						on:click={() => handleSuggestionClick('Create a charter to start a film club')}
						class="p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left"
					>
						<h2 class="font-bold text-white text-sm overflow-ellipsis truncate">
							Create a charter
						</h2>
						<h3 class="text-sm overflow-ellipsis truncate">to start a film club</h3>
					</button>
					<button
						on:click={() =>
							handleSuggestionClick(
								'Brainstorm edge cases for a function with birthday as input, horoscope as output'
							)}
						class="p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left overflow-ellipsis"
					>
						<h2 class="font-bold text-white text-sm overflow-ellipsis truncate">
							Brainstorm edge cases
						</h2>
						<h3 class="text-sm overflow-ellipsis truncate">
							for a function with birthday as input, horoscope as output
						</h3>
					</button>
					<button
						on:click={() =>
							handleSuggestionClick('Plan a trip to explore the Madagascar wildlife on a budget')}
						class="p-3 border border-zinc-800 rounded-lg hover:bg-zinc-700 text-left"
					>
						<h2 class="font-bold text-white text-sm overflow-ellipsis truncate">Plan a trip</h2>
						<h3 class="text-sm overflow-ellipsis truncate">
							to explore the Madagascar wildlife on a budget
						</h3>
					</button>
				</div>
			{:else}
				<div class="flex-1 p-4">
					{#each $messages as message, index}
						<div class="mb-4">
							{#if message.role === 'user'}
								<Message
									{message}
									name={'You'}
									isLastMessage={index === $messages.length - 1}
									profilePicture={$user
										? $user.profilePicture
										: './assets/default-profile-picture.webp'}
								/>
							{:else}
								<Message
									{message}
									name={'AI'}
									isLastMessage={index === $messages.length - 1}
									profilePicture={'./assets/ai-profile-picture.webp'}
								/>
							{/if}
						</div>
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
							{#if imagePreviewUrl}
								<div class="relative p-2 w-content">
									<div class="w-fit">
										<img src={imagePreviewUrl} alt="Preview" class="h-14 w-14 rounded-md" />
										{#if $isUploading}
											<div
												class="mt-2 absolute top-0 h-14 w-14 flex justify-center items-center bg-black bg-opacity-50 rounded-md"
											>
												<svg
													class="animate-spin h-5 w-5 text-white"
													xmlns="http://www.w3.org/2000/svg"
													fill="none"
													viewBox="0 0 24 24"
												>
													<circle
														class="opacity-25"
														cx="12"
														cy="12"
														r="10"
														stroke="currentColor"
														stroke-width="4"
													></circle>
													<path
														class="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
													></path>
												</svg>
											</div>
										{/if}
										<button
											class="absolute top-0 left-14 p-1 w-5 h-5 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 cursor-pointer"
											on:click={removeAttachment}
										>
											<MdClose class="text-white" />
										</button>
									</div>
								</div>
							{/if}
							<div class="flex">
								<input type="file" id="file" class="hidden" on:change={handleFileSelection} />

								<label
									for="file"
									class="text-zinc-300 hover:text-white font-bold text-sm rounded-lg cursor-pointer w-10 h-10 p-2"
								>
									<MdAttachFile />
								</label>
								<textarea
									bind:value={$input}
									bind:this={textarea}
									on:input={autoGrow}
									on:keydown={handleKeyDown}
									rows="1"
									placeholder="Message AI..."
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
						This is an unofficial open source UI for the OpenAI API.
					</p>
				</div>
			</div>
		</main>
	</div>
</div>
