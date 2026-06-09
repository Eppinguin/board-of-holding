<script lang="ts">
	import { tick, onDestroy, untrack } from "svelte";
	import type { Component } from "obsidian";
	import type { ScreenCard } from "../../core/cards/card-types";
	import type { SearchResult } from "../../core/search/SearchTypes";
	import type { GMScreenController } from "../controller";
	import { folderSuggest } from "../suggest";

	const { card, controller, hostComponent, editMode = false }: {
		card: ScreenCard<"search">;
		controller: GMScreenController;
		hostComponent: Component;
		editMode?: boolean;
	} = $props();

	const app = untrack(() => controller.getApp());
	let config = $state(untrack(() => ({ ...card.config })));
	let foldersInput = $state(untrack(() => config.folders.join(", ")));
	let query = $state("");
	let results: SearchResult[] = $state([]);
	let searched = $state(false);
	let error = $state("");
	let expandedId: string | null = $state(null);
	let debounceTimer: number | null = null;
	const renderEls: Record<string, HTMLDivElement> = {};

	function saveConfig(): void {
		config.folders = foldersInput
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
		config.limit = Math.max(1, Math.min(200, Number(config.limit) || 20));
		controller.updateCardConfig(card.id, "search", config);
		if (query.trim()) runSearch();
	}

	function runSearch(): void {
		const q = query.trim();
		if (!q) {
			results = [];
			searched = false;
			expandedId = null;
			return;
		}
		error = "";
		searched = true;
		try {
			results = controller.search(query, config);
			const topResult = results[0];
			expandedId = topResult?.doc.id ?? null;
			if (topResult) {
				void tick().then(() => {
					const el = renderEls[topResult.doc.id];
					if (el && !el.hasChildNodes()) {
						void controller.renderMarkdown(topResult.doc.body, el, topResult.doc.filePath, hostComponent);
					}
				});
			}
		} catch (searchError) {
			error = searchError instanceof Error ? searchError.message : "Search failed";
			results = [];
			expandedId = null;
		}
	}

	function onInput(): void {
		if (debounceTimer) window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			runSearch();
			debounceTimer = null;
		}, 140);
	}

	function clearQuery(): void {
		query = "";
		results = [];
		searched = false;
		expandedId = null;
	}

	async function toggleExpand(result: SearchResult): Promise<void> {
		const id = result.doc.id;
		if (expandedId === id) {
			expandedId = null;
			return;
		}
		expandedId = id;
		await tick();
		const el = renderEls[id];
		if (el && !el.hasChildNodes()) {
			await controller.renderMarkdown(result.doc.body, el, result.doc.filePath, hostComponent);
		}
	}

	async function openResult(result: SearchResult, e: MouseEvent): Promise<void> {
		e.stopPropagation();
		await controller.openFileInLeaf(result.doc.filePath, result.doc.heading);
	}

	function pinResult(result: SearchResult, e: MouseEvent): void {
		e.stopPropagation();
		controller.pinSearchResultAsNoteCard(result.doc.filePath, result.doc.heading);
	}

	onDestroy(() => {
		if (debounceTimer) window.clearTimeout(debounceTimer);
	});
</script>

<div class="gm-search-bar">
	<svg class="gm-search-bar-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		class="gm-search-input"
		bind:value={query}
		oninput={onInput}
		placeholder="Search…"
		spellcheck="false"
	/>
	{#if query}
		<button class="gm-search-clear" onclick={clearQuery} title="Clear" aria-label="Clear search">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>
	{/if}
</div>

{#if editMode}
	<div class="gm-card-settings">
		<span class="gm-field-label">Folders <span class="gm-field-hint">(leave empty for all)</span></span>
		<input
			class="gm-input"
			bind:value={foldersInput}
			placeholder="e.g. Rules, Monsters"
			onchange={saveConfig}
			use:folderSuggest={{ app, onSelect: (v) => {
				const tokens = foldersInput.split(",").map(s => s.trim()).filter(Boolean);
				const confirmed = tokens.slice(0, -1).filter(t => t !== v);
				foldersInput = confirmed.length ? confirmed.join(", ") + ", " + v : v;
				saveConfig();
			}}}
		/>
		<span class="gm-field-label">Max results</span>
		<input class="gm-input" type="number" min="1" max="200" bind:value={config.limit} onchange={saveConfig} />
	</div>
{/if}

{#if error}
	<div class="gm-card-error">{error}</div>
{/if}

{#if searched && results.length === 0 && !error}
	<div class="gm-search-empty">No results for "{query}"</div>
{/if}

{#if results.length > 0}
	<div class="gm-results">
		{#each results as result (result.doc.id)}
			{@const expanded = expandedId === result.doc.id}
			{@const isSection = result.doc.kind === "section"}
			<div class="gm-result" class:gm-result--expanded={expanded}>
				<div
					class="gm-result-row"
					role="button"
					tabindex="0"
					onclick={() => toggleExpand(result)}
					onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(result); } }}
				>
					<svg class="gm-result-chevron" class:gm-result-chevron--open={expanded} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
					<span class="gm-result-title">{isSection ? result.doc.heading : result.doc.title}</span>
					<span class="gm-result-context">{isSection ? result.doc.title : result.doc.folder}</span>
					<span class="gm-result-actions">
						<button class="gm-result-action" title="Open in editor" aria-label="Open in editor" onclick={(e) => openResult(result, e)}>
							<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
						</button>
						<button class="gm-result-action" title="Pin as note card" aria-label="Pin as note card" onclick={(e) => pinResult(result, e)}>
							<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
						</button>
					</span>
				</div>
				{#if expanded}
					<div class="gm-result-body markdown-rendered" bind:this={renderEls[result.doc.id]}></div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
