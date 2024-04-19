<script lang="ts">
	export let message: any;
	export let name: string;
	export let imageUrl: string;
</script>

<div class="flex space-x-2">
	<img class="h-6 w-6 rounded-2xl" src={imageUrl} />
	<div>
		<div class="text-white font-bold text-sm">{name}</div>
		<div class="text-white text-sm">
			{message.content}
		</div>
	</div>
</div>
