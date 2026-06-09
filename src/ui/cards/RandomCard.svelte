<script lang="ts">
	import { tick, untrack } from "svelte";
	import type { Component } from "obsidian";
	import type { ScreenCard, RandomGeneratorType, RandomGeneratorTypeOverride } from "../../core/cards/card-types";
	import type { RollEntry, RollResult } from "../../core/random/GeneratorService";
	import type { GMScreenController } from "../controller";
	import { fileSuggest } from "../suggest";

	const { card, controller, hostComponent, editMode = false }: {
		card: ScreenCard<"random">;
		controller: GMScreenController;
		hostComponent: Component;
		editMode?: boolean;
	} = $props();

	const app = untrack(() => controller.getApp());

	// Measured width of the result area, used to switch between a wide table
	// layout and a narrow stacked-card layout. Bound via bind:clientWidth so it
	// stays current as the card is resized.
	let resultWidth = $state(0);

	const TYPE_LABELS: Record<RandomGeneratorType, string> = {
		list: "list item",
		table: "table row",
		sections: "section",
		files: "file"
	};

	let config = $state(untrack(() => ({ ...card.config })));
	let result: RollResult | null = $state(null);
	let history: RollResult[] = $state([]);
	let error = $state("");
	let rolling = $state(false);
	// auto-detected type (ignoring the override); null while loading or on error
	let autoDetected: RandomGeneratorType | null = $state(null);
	// The type that will actually run (override ?? autoDetected)
	let detected: RandomGeneratorType | null = $state(null);
	// Types that are actually present in the source (gates the override buttons).
	let availableTypes: Set<RandomGeneratorType> = $state(new Set());
	// Column headers of the source table, for the column picker in edit mode.
	let availableColumns: string[] = $state([]);

	const ready = $derived(config.source.trim().length > 0 || config.folder.trim().length > 0);
	const displayLabel = $derived(config.label.trim() || (detected ? TYPE_LABELS[detected] : "result"));

	// When a roll returns several table rows, render them as a single table so the
	// column headers only appear once.
	type TableRowEntry = Extract<RollEntry, { kind: "table-row" }>;
	const tableRows = $derived(
		(result?.entries ?? []).filter((e): e is TableRowEntry => e.kind === "table-row")
	);
	const isTableResult = $derived(tableRows.length > 0 && tableRows.length === (result?.entries.length ?? 0));
	const hasTitleColumn = $derived(tableRows.some((row) => Boolean(row.title)));
	// Column headers, taken from the first row (rows from one source share columns).
	const fieldHeaders = $derived(tableRows[0]?.fields.map((f) => f.header) ?? []);
	// Width the wide table needs before it would start cramping: ~100px per data
	// column plus the fixed-width title column. Below this the rows stack instead.
	const tableMinWidth = $derived(fieldHeaders.length * 100 + (hasTitleColumn ? 90 : 0));
	// Default to stacked until measured (avoids a wide-table flash on a narrow card).
	const useTableLayout = $derived(resultWidth > 0 && resultWidth >= tableMinWidth);

	// True once the effective type is a table — gates the table-only settings.
	const isTableSource = $derived(detected === "table");

	// Re-detect what the source points at whenever it changes (best-effort, for
	// the hint, button label, and column picker).
	$effect(() => {
		void detect(config.source, config.folder, config.generatorType);
	});

	async function detect(
		_source: string,
		_folder: string,
		_override: RandomGeneratorTypeOverride
	): Promise<void> {
		if (!ready) {
			autoDetected = null;
			detected = null;
			availableColumns = [];
			return;
		}
		try {
			const available = await controller.detectAvailableTypes(config);
			availableTypes = new Set(available);
			autoDetected = available[0] ?? null;
			// Clear a stale override if the new source no longer supports it.
			if (config.generatorType && !availableTypes.has(config.generatorType)) {
				config.generatorType = null;
				saveConfig();
			}
			detected = config.generatorType ?? autoDetected;
		} catch {
			autoDetected = null;
			detected = null;
			availableTypes = new Set();
		}
		availableColumns = detected === "table" ? await controller.getTableColumns(config) : [];
	}

	function toggleColumn(header: string): void {
		config.columns = config.columns.includes(header)
			? config.columns.filter((c) => c !== header)
			: [...config.columns, header];
		saveConfig();
	}

	function saveConfig(): void {
		config = {
			...config,
			label: config.label.trim(),
			source: config.source.trim(),
			folder: config.folder.trim()
		};
		controller.updateCardConfig(card.id, "random", config);
	}

	async function roll(): Promise<void> {
		if (rolling) return;
		rolling = true;
		error = "";
		try {
			const next = await controller.rollRandom(config);
			if (result && config.showHistory) {
				history = [result, ...history].slice(0, 20);
			}
			result = next;
		} catch (rollError) {
			error = rollError instanceof Error ? rollError.message : "Roll failed";
		} finally {
			rolling = false;
		}
	}

	function clearHistory(): void {
		history = [];
	}

	async function copyEntry(entry: RollEntry): Promise<void> {
		try {
			await navigator.clipboard.writeText(entryToText(entry));
		} catch {
			error = "Clipboard copy failed";
		}
	}

	function entryToText(entry: RollEntry): string {
		switch (entry.kind) {
			case "text":
			case "markdown":
				return entry.value;
			case "file":
				return entry.path;
			case "table-row": {
				const parts = entry.fields.map((f) => f.value);
				if (entry.title) parts.unshift(entry.title);
				return parts.filter(Boolean).join(" — ");
			}
		}
	}

	async function openFile(path: string): Promise<void> {
		await controller.openFileInLeaf(path);
	}

	function md(node: HTMLElement, value: string) {
		const render = (markdown: string) => {
			node.replaceChildren();
			void controller.renderMarkdown(markdown, node, "", hostComponent);
		};
		void tick().then(() => render(value));
		return {
			update(next: string) {
				render(next);
			}
		};
	}
</script>

{#if editMode}
	<div class="gm-card-settings">
		<span class="gm-field-label">Source <span class="gm-field-hint">(note, #heading, or folder)</span></span>
		<input
			class="gm-input"
			bind:value={config.source}
			placeholder="Note, Note#Heading, [[wikilink]], or folder path"
			onchange={saveConfig}
			use:fileSuggest={{ app, onSelect: (v) => { config.source = v; saveConfig(); } }}
		/>

		{#if ready}
			<span class="gm-field-hint gm-random-gen-hint">
				{#if detected}
					{config.generatorType
						? `Locked to ${TYPE_LABELS[detected]}s.`
						: `Auto-detected: picks a random ${TYPE_LABELS[detected]}.`}
					{#if autoDetected && config.generatorType && autoDetected !== config.generatorType}
						<span class="gm-field-hint-muted">(auto would pick {TYPE_LABELS[autoDetected]})</span>
					{/if}
				{:else}
					Couldn't read this source yet — check the path.
				{/if}
			</span>
		{/if}

		{#if ready && availableTypes.size > 0}
			<span class="gm-field-label">Generator</span>
			<div class="gm-segmented gm-segmented--wrap">
				<button type="button" class="gm-segmented-btn" class:is-active={config.generatorType === null}
					onclick={() => { config.generatorType = null; saveConfig(); }}>Auto</button>
				{#each (["list", "table", "sections", "files"] as const) as type}
					<button
						type="button"
						class="gm-segmented-btn"
						class:is-active={config.generatorType === type}
						disabled={!availableTypes.has(type)}
						onclick={() => { config.generatorType = type; saveConfig(); }}
					>{type[0].toUpperCase() + type.slice(1)}</button>
				{/each}
			</div>
		{/if}

		<span class="gm-field-label">Label <span class="gm-field-hint">(optional)</span></span>
		<input class="gm-input" bind:value={config.label} placeholder={detected ? TYPE_LABELS[detected] : "result"} onchange={saveConfig} />

		{#if isTableSource}
			<span class="gm-field-label">Roll</span>
			<div class="gm-segmented">
				<button
					type="button"
					class="gm-segmented-btn"
					class:is-active={config.tableAxis === "rows"}
					onclick={() => { config.tableAxis = "rows"; saveConfig(); }}
				>Whole rows</button>
				<button
					type="button"
					class="gm-segmented-btn"
					class:is-active={config.tableAxis === "columns"}
					onclick={() => { config.tableAxis = "columns"; saveConfig(); }}
				>A column value</button>
			</div>

			{#if availableColumns.length > 0}
				<span class="gm-field-label">
					Columns
					<span class="gm-field-hint">
						{config.tableAxis === "columns"
							? "(roll from these — none = any)"
							: "(show these — none = all)"}
					</span>
				</span>
				<div class="gm-chip-row">
					{#each availableColumns as header}
						<button
							type="button"
							class="gm-chip"
							class:is-active={config.columns.includes(header)}
							onclick={() => toggleColumn(header)}
						>{header}</button>
					{/each}
				</div>
			{/if}
		{/if}

		<div class="gm-settings-row gm-random-settings-row">
			<label class="gm-settings-field gm-random-count-field">
				<span class="gm-field-label">Per roll</span>
				<input class="gm-input" type="number" min="1" max="20" bind:value={config.count} onchange={saveConfig} />
			</label>
			<label class="gm-checkbox-label">
				<input type="checkbox" bind:checked={config.showHistory} onchange={saveConfig} />
				Keep history
			</label>
			<label class="gm-checkbox-label">
				<input type="checkbox" bind:checked={config.showHeaders} onchange={saveConfig} />
				Show headers
			</label>
		</div>
	</div>
{:else}
	<div class="gm-random">
		<div class="gm-random-bar">
			<button
				class="gm-btn-primary gm-roll-btn"
				onclick={roll}
				disabled={rolling || !ready}
				title={ready ? "" : "Set a source in edit mode"}
			>
				{#if rolling}
					Rolling…
				{:else}
					Roll {displayLabel}
				{/if}
			</button>
			{#if history.length > 0}
				<button class="gm-inline-icon-btn" title="Clear history" onclick={clearHistory} aria-label="Clear history">
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
				</button>
			{/if}
		</div>

		{#if error}
			<div class="gm-card-error">{error}</div>
		{/if}

		{#if !ready}
			<div class="gm-card-muted">Open card settings to set a source.</div>
		{/if}

		{#if result}
			<div class="gm-random-result" bind:clientWidth={resultWidth}>
				<div class="gm-random-meta">{result.meta}</div>

				{#if isTableResult && useTableLayout}
					<!-- Wide enough: one table, headers shown once, a row per result. -->
					<table class="gm-random-table">
						{#if config.showHeaders}
							<thead>
								<tr>
									{#if hasTitleColumn}<th class="gm-random-th-title"></th>{/if}
									{#each fieldHeaders as header}
										<th>{header}</th>
									{/each}
								</tr>
							</thead>
						{/if}
						<tbody>
							{#each tableRows as row}
								<tr>
									{#if hasTitleColumn}
										<td class="gm-random-td-title">
											{#if row.title}<div use:md={row.title}></div>{/if}
										</td>
									{/if}
									{#each row.fields as field}
										<td>
											<div class="gm-random-cell-value" use:md={field.value}></div>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{:else if isTableResult && tableRows.length > 1}
					<!-- Multiple results: one shared grid — labels once on the left,
					     each result's values in its own column. -->
					<div
						class="gm-random-multi"
						style="--gm-multi-cols: {tableRows.length}"
					>
						<!-- Title row -->
						{#if hasTitleColumn && config.showHeaders}
							<div class="gm-random-multi-label"></div>
						{/if}
						{#each tableRows as row}
							<div class="gm-random-card-title">
								{#if row.title}<span use:md={row.title}></span>{/if}
							</div>
						{/each}
						<!-- Field rows -->
						{#each fieldHeaders as header, fi}
							{#if config.showHeaders}
								<div class="gm-random-multi-label">{header}</div>
							{/if}
							{#each tableRows as row}
								<div class="gm-random-cell-value" use:md={row.fields[fi]?.value ?? ""}></div>
							{/each}
						{/each}
					</div>
				{:else if isTableResult}
					<!-- Single result: stacked card with fields in a multi-column layout. -->
					<div class="gm-random-card">
						{#if tableRows[0]?.title}
							<div class="gm-random-card-title" use:md={tableRows[0].title}></div>
						{/if}
						<div class="gm-random-card-fields">
							{#each tableRows[0]?.fields ?? [] as field}
								<div class="gm-random-card-field" class:gm-random-card-field--labelled={config.showHeaders && field.header}>
									{#if config.showHeaders && field.header}
										<span class="gm-random-cell-label">{field.header}</span>
									{/if}
									<div class="gm-random-cell-value" use:md={field.value}></div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					{#each result.entries as entry}
						<div class="gm-random-entry">
							{#if entry.kind === "file"}
								<button class="gm-random-file-link" onclick={() => openFile(entry.path)} title={entry.path}>
									{entry.title}
								</button>
							{:else if entry.kind === "markdown"}
								<div class="gm-random-markdown" use:md={entry.value}></div>
							{:else if entry.kind === "text"}
								<div class="gm-random-value">{entry.value}</div>
							{/if}
							<button class="gm-random-copy gm-inline-icon-btn" title="Copy" aria-label="Copy result" onclick={() => copyEntry(entry)}>
								<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>
		{/if}

		{#if config.showHistory && history.length > 0}
			<div class="gm-random-history">
				<div class="gm-random-history-label">History</div>
				{#each history as past}
					{#each past.entries as entry}
						<div class="gm-random-history-item">{entryToText(entry)}</div>
					{/each}
				{/each}
			</div>
		{/if}
	</div>
{/if}
