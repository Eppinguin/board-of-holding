<script lang="ts">
	import { untrack } from "svelte";
	import type { ScreenCard } from "../../core/cards/card-types";
	import type { GMScreenController } from "../controller";

	const { card, controller, editMode = false }: {
		card: ScreenCard<"webEmbed">;
		controller: GMScreenController;
		editMode?: boolean;
	} = $props();

	let config = $state(untrack(() => ({ ...card.config })));
	let frameKey = $state(0);
	let error = $state("");

	function saveConfig(): void {
		config = {
			...config,
			url: config.url.trim(),
			title: config.title?.trim() || undefined
		};
		controller.updateCardConfig(card.id, "webEmbed", config);
		error = "";
		frameKey += 1;
	}

	function refreshFrame(): void {
		frameKey += 1;
		error = "";
	}

	function openExternally(): void {
		if (!config.url) return;
		window.open(config.url, "_blank", "noopener,noreferrer");
	}

	function onFrameError(): void {
		error = "This site blocks embedding. Try opening externally.";
	}
</script>

{#if editMode}
	<div class="gm-card-settings">
		<span class="gm-field-label">URL</span>
		<input class="gm-input" bind:value={config.url} placeholder="https://example.com" onchange={saveConfig} />
		<span class="gm-field-label">Title <span class="gm-field-hint">(optional)</span></span>
		<input class="gm-input" bind:value={config.title} placeholder="Custom title" onchange={saveConfig} />
		<label class="gm-checkbox-label">
			<input type="checkbox" bind:checked={config.allowScripts} onchange={saveConfig} />
			Allow scripts
		</label>
	</div>
{:else if config.url}
	<div class="gm-web-actions">
		<button class="gm-inline-icon-btn" title="Refresh" onclick={refreshFrame}>
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
		</button>
		<button class="gm-inline-icon-btn" title="Open in browser" onclick={openExternally}>
			<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
		</button>
	</div>
{/if}

{#if error}
	<div class="gm-card-error">{error}</div>
{/if}

{#if config.url}
	{#key frameKey}
		<iframe
			title={config.title || config.url}
			class="gm-web-embed"
			src={config.url}
			sandbox={config.allowScripts ? "allow-scripts allow-same-origin allow-forms" : "allow-same-origin"}
			onerror={onFrameError}
		></iframe>
	{/key}
{:else if !editMode}
	<div class="gm-card-muted">Enter a URL in edit mode to embed a page.</div>
{/if}
