<script lang="ts">
	import type { Component } from "obsidian";
	import Screen from "./Screen.svelte";
	import CardPalette from "./components/CardPalette.svelte";
	import type { GMScreenController } from "./controller";

	const { controller, hostComponent }: { controller: GMScreenController; hostComponent: Component } = $props();

	let editMode = $state(false);
	const layoutLocked = $derived(!editMode);
</script>

<div class="gm-screen-app">
	<div class="gm-screen-toolbar">
		<div class="gm-screen-toolbar-left">
			<button
				class="gm-toolbar-btn {editMode ? 'gm-toolbar-btn--active' : ''}"
				title={editMode ? "Exit edit mode" : "Edit layout"}
				onclick={() => (editMode = !editMode)}
			>
				<!-- pencil icon -->
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
				{editMode ? "Done" : "Edit"}
			</button>
			{#if editMode}
				<div class="gm-toolbar-divider"></div>
				<CardPalette {controller} />
			{/if}
		</div>
	</div>

	<Screen {controller} {hostComponent} {layoutLocked} {editMode} />
</div>
