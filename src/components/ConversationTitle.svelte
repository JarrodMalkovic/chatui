<script lang="ts">
	import { Dropdown, Modal } from 'flowbite-svelte';
	import GoKebabHorizontal from 'svelte-icons/go/GoKebabHorizontal.svelte';
	import MdWarning from 'svelte-icons/md/MdWarning.svelte';
	import { user } from '$lib/auth';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { tick } from 'svelte';
	import { t } from 'svelte-i18n-lingui';

	export let conversation: any;
	export let conversations: any[];
	export let isActive: boolean = false;

	let dropdownOpen = false;
	let showModal = false;
	let renameInput;
	let conversationToRename = null;
	let conversationToDelete = null;

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

	async function handleUpdateConversationTitle(event) {
		event.preventDefault();
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

		conversationToRename = null;
		dropdownOpen = false;
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
</script>

{#if showModal}
	<div class={'absolute top-0 z-[999] bg-zinc-950 bg-opacity-70 w-screen h-screen'} use:portal>
		<Modal
			bind:open={showModal}
			dismissable={false}
			outsideclose={true}
			size="xs"
			class="bg-zinc-800"
			backdropClass=""
		>
			<div class="mx-auto mb-4 text-white w-12 h-12"><MdWarning /></div>
			<div class="text-center space-x-2 text-white">
				<h3 class="mb-5 text-md font-normal">
					{$t`Are you sure you want to delete this conversation?`}
				</h3>
				<button
					class="text-sm border p-2 rounded-xl border-zinc-500"
					on:click={() => (showModal = false)}>{$t`Cancel`}</button
				>
				<button class="text-sm p-2 rounded-xl bg-red-600 hover:bg-red-800" on:click={confirmDelete}>
					{$t`Delete`}
				</button>
			</div>
		</Modal>
	</div>
{/if}

{#if conversation.id === conversationToRename}
	<input
		bind:this={renameInput}
		class="text-white px-2 py-2 bg-transparent rounded-lg w-full text-xs bg-zinc-800 border border-zinc-700 focus:outline-0 focus-visible:ring-0 focus:border-zinc-600"
		value={conversation.title}
		on:focusout={handleUpdateConversationTitle}
	/>
{:else}
	<div
		class="group flex pr-2 justify-between items-center text-xs hover:bg-zinc-800 w-full rounded-lg {isActive ||
		dropdownOpen
			? 'bg-zinc-900'
			: ''}"
	>
		<a class="text-white pl-2 py-2 text-left truncate w-full h-full" href="/{conversation.id}"
			>{conversation.title ?? 'New chat'}</a
		>
		<div class="relative">
			<button
				id={`conversationButton-${conversation.id}`}
				tabindex="0"
				class="z-0 group-hover:opacity-100 max-h-4 max-w-4 hover:text-zinc-400 flex {isActive ||
				dropdownOpen
					? 'opacity-100'
					: 'opacity-0'}"
			>
				<GoKebabHorizontal />
			</button>
			<Dropdown
				triggeredBy={`#conversationButton-${conversation.id}`}
				placement="bottom-end"
				bind:open={dropdownOpen}
				class="z-[9999] max-h-96 w-64 overflow-scroll space-y-3"
				containerClass="flex bg-zinc-800 rounded-xl text-white border border-zinc-700 ml-2.5 mt-2.5 z-[9999] "
			>
				<div class="space-y-2 p-1">
					<button
						class="w-full text-left p-2 hover:bg-zinc-700 rounded-lg text-sm"
						on:click={() => handleRenameClick(conversation.id)}
					>
						{$t`Rename`}
					</button>

					<button
						class="w-full text-left p-2 hover:bg-zinc-700 rounded-lg text-sm"
						on:click={() => handleDeleteClick(conversation.id)}
					>
						{$t`Delete`}
					</button>
				</div>
			</Dropdown>
		</div>
	</div>
{/if}
