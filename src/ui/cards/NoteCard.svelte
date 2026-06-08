<script lang="ts">
	import { onMount } from "svelte";
	import type { Component } from "obsidian";
	import type { ScreenCard } from "../../core/cards/card-types";
	import { parseNoteTarget } from "../../core/notes/NoteResolver";
	import type { GMScreenController } from "../controller";
	import { fileSuggest } from "../suggest";

export let card: ScreenCard<"note">;
export let controller: GMScreenController;
export let hostComponent: Component;
export let editMode = false;

	const app = controller.getApp();
	let config = { ...card.config };
	let renderEl: HTMLDivElement;
	let error = "";
	let loading = false;
	let resolvedPath = "";

	async function refresh(): Promise<void> {
		loading = true;
		error = "";
		try {
			const resolved = await controller.resolveNoteCard(config);
			resolvedPath = resolved.path;
			await controller.renderMarkdown(resolved.markdown, renderEl, resolved.path, hostComponent);
		} catch (renderError) {
			error = renderError instanceof Error ? renderError.message : "Failed to render note";
			renderEl?.replaceChildren();
		} finally {
			loading = false;
		}
	}

	function saveConfig(): void {
		config = { ...config, source: config.source.trim() };
		controller.updateCardConfig(card.id, "note", config);
		void refresh();
	}

	async function openSource(): Promise<void> {
		const target = parseNoteTarget(config.source);
		const path = resolvedPath || target.path;
		if (!path) return;
		await controller.openFileInLeaf(path, target.heading);
	}
</script>

{#if editMode}
	<div class="gm-card-settings">
		<span class="gm-field-label">
			Note <span class="gm-field-hint">— add #Heading or #^block to focus a section</span>
		</span>
		<input
			class="gm-input"
			bind:value={config.source}
			placeholder="Note, Note#Heading, or [[wikilink]]"
			onchange={saveConfig}
			use:fileSuggest={{ app, onSelect: (v) => { config.source = v; saveConfig(); } }}
		/>
		<button class="gm-btn-secondary" onclick={openSource} disabled={!resolvedPath && !config.source}>Open note</button>
	</div>
{:else}
	<div class="gm-note-actions">
		<button class="gm-inline-icon-btn" title="Refresh" onclick={refresh} disabled={loading}>
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="{loading ? 'gm-spin' : ''}"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
		</button>
		{#if resolvedPath || config.source}
			<button class="gm-inline-icon-btn" title="Open source note" onclick={openSource}>
				<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
			</button>
		{/if}
	</div>
{/if}

{#if error}
	<div class="gm-card-error">{error}</div>
{/if}
<div class="gm-note-render" bind:this={renderEl}></div>
