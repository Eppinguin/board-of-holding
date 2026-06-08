<script lang="ts">
	export let title: string;
	export let config: unknown;
	export let onSave: (value: unknown) => void;
	export let onClose: () => void;

	let draft = JSON.stringify(config, null, 2);
	let error = "";

	function tryClose(): void {
		try {
			const parsed = JSON.parse(draft);
			onSave(parsed);
			error = "";
			onClose();
		} catch (saveError) {
			error = saveError instanceof Error ? saveError.message : "Invalid JSON";
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent): void {
		if (event.key === "Escape") {
			event.preventDefault();
			tryClose();
		}
	}
</script>

<div
	class="gm-modal-backdrop"
	role="button"
	tabindex="0"
	aria-label="Close card settings"
	onclick={tryClose}
	onkeydown={handleBackdropKeydown}
>
	<div
		class="gm-modal"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<h3>{title}</h3>
		<textarea bind:value={draft} class="gm-card-config-editor"></textarea>
		{#if error}
			<div class="gm-card-error">{error}</div>
		{/if}
	</div>
</div>
