<script lang="ts">
	import { untrack } from "svelte";
	import { Notice } from "obsidian";
	import type { GMScreenController } from "../controller";

	const { controller, editMode = false }: {
		controller: GMScreenController;
		editMode?: boolean;
	} = $props();

	// Bump to force re-reading the screen list after mutations.
	let revision = $state(0);
	let activeLayout = $state(untrack(() => controller.getActiveLayout()));

	const unsubscribe = untrack(() =>
		controller.layoutStore.subscribe((layout) => {
			activeLayout = layout;
			revision += 1;
		})
	);

	$effect(() => () => unsubscribe());

	const screens = $derived.by(() => {
		void revision;
		return controller.listScreens();
	});
	const activeId = $derived(activeLayout?.id ?? null);
	const activeName = $derived(activeLayout?.name ?? "GM Screen");

	let menuOpen = $state(false);
	// "create" | "paste" | null — global menu editors. Per-row rename uses renamingId.
	let editing: "create" | "paste" | null = $state(null);
	let renamingId: string | null = $state(null);
	let nameDraft = $state("");
	let pasteDraft = $state("");
	let inputEl: HTMLInputElement | null = $state(null);
	let rowInputEl: HTMLInputElement | null = $state(null);
	let pasteEl: HTMLTextAreaElement | null = $state(null);
	let fileInputEl: HTMLInputElement | null = $state(null);

	function closeMenu(): void {
		menuOpen = false;
		editing = null;
		renamingId = null;
	}

	function toggleMenu(): void {
		menuOpen = !menuOpen;
		editing = null;
		renamingId = null;
	}

	async function switchTo(id: string): Promise<void> {
		if (renamingId) return;
		closeMenu();
		if (id === activeId) return;
		await controller.openScreen(id);
	}

	function startCreate(): void {
		editing = "create";
		nameDraft = "GM Screen";
		focusInput();
	}

	function startRename(id: string, name: string): void {
		editing = null;
		renamingId = id;
		nameDraft = name;
		queueMicrotask(() => {
			rowInputEl?.focus();
			rowInputEl?.select();
		});
	}

	function focusInput(): void {
		queueMicrotask(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	}

	function cancelEdit(): void {
		editing = null;
		nameDraft = "";
	}

	function cancelRename(): void {
		renamingId = null;
		nameDraft = "";
	}

	async function commitEdit(): Promise<void> {
		const name = nameDraft.trim();
		editing = null;
		if (!name) return;
		closeMenu();
		await controller.createScreen(name);
	}

	async function commitRename(): Promise<void> {
		const id = renamingId;
		const name = nameDraft.trim();
		renamingId = null;
		if (!id || !name) return;
		await controller.renameScreen(id, name);
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter") {
			e.preventDefault();
			void commitEdit();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelEdit();
		}
	}

	function onRowKeydown(e: KeyboardEvent): void {
		if (e.key === "Enter") {
			e.preventDefault();
			void commitRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelRename();
		}
	}

	async function deleteScreen(id: string, name: string): Promise<void> {
		if (screens.length <= 1) return;
		const ok = window.confirm(`Delete screen "${name}"? This cannot be undone.`);
		if (!ok) return;
		await controller.deleteScreen(id);
	}

	function slugify(name: string): string {
		return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "screen";
	}

	function exportToFile(): void {
		if (!activeId) return;
		closeMenu();
		try {
			const json = controller.exportScreen(activeId);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${slugify(activeName)}.gmscreen.json`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async function exportToClipboard(): Promise<void> {
		if (!activeId) return;
		closeMenu();
		try {
			const json = controller.exportScreen(activeId);
			await navigator.clipboard.writeText(json);
			new Notice("Screen copied to clipboard.");
		} catch (error) {
			new Notice(`Copy failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function importFromFile(): void {
		fileInputEl?.click();
	}

	async function onFileChosen(e: Event): Promise<void> {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		closeMenu();
		try {
			const text = await file.text();
			await controller.importScreen(text);
			new Notice("Screen imported.");
		} catch (error) {
			new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function startPaste(): void {
		editing = "paste";
		pasteDraft = "";
		queueMicrotask(() => pasteEl?.focus());
	}

	async function commitPaste(): Promise<void> {
		const text = pasteDraft.trim();
		if (!text) {
			cancelEdit();
			return;
		}
		closeMenu();
		try {
			await controller.importScreen(text);
			new Notice("Screen imported.");
		} catch (error) {
			new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
</script>

<svelte:window onclick={(e) => {
	const target = e.target as HTMLElement;
	if (!target.closest(".gm-screen-switcher")) closeMenu();
}} />

<div class="gm-screen-switcher">
	{#if editing === "rename"}
		<input
			class="gm-input gm-screen-switcher-input"
			bind:this={inputEl}
			bind:value={nameDraft}
			onkeydown={onKeydown}
			onblur={commitEdit}
			placeholder="Screen name"
			spellcheck="false"
		/>
	{:else}
		<button class="gm-toolbar-btn gm-screen-switcher-trigger" onclick={toggleMenu} title="Switch screen">
			<!-- layers icon -->
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
			<span class="gm-screen-switcher-name">{activeName}</span>
			<svg class="gm-screen-switcher-caret" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
		</button>
	{/if}

	<input
		class="gm-screen-switcher-file"
		type="file"
		accept=".json,application/json"
		bind:this={fileInputEl}
		onchange={onFileChosen}
	/>

	{#if menuOpen}
		<div class="gm-screen-switcher-menu">
			{#each screens as screen (screen.id)}
				{#if renamingId === screen.id}
					<div class="gm-screen-switcher-row gm-screen-switcher-row--editing">
						<input
							class="gm-input gm-screen-switcher-row-input"
							bind:this={rowInputEl}
							bind:value={nameDraft}
							onkeydown={onRowKeydown}
							onblur={commitRename}
							placeholder="Screen name"
							spellcheck="false"
						/>
					</div>
				{:else}
					<div class="gm-screen-switcher-row">
						<button
							class="gm-screen-switcher-item {screen.id === activeId ? 'gm-screen-switcher-item--active' : ''}"
							onclick={() => switchTo(screen.id)}
						>
							<svg class="gm-screen-switcher-check" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{#if screen.id === activeId}<polyline points="20 6 9 17 4 12"/>{/if}</svg>
							<span class="gm-screen-switcher-item-name">{screen.name}</span>
						</button>
						{#if editMode}
							<div class="gm-screen-switcher-row-actions">
								<button
									class="gm-screen-switcher-row-btn"
									onclick={(e) => { e.stopPropagation(); startRename(screen.id, screen.name); }}
									title="Rename screen"
									aria-label="Rename screen"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
								</button>
								<button
									class="gm-screen-switcher-row-btn gm-screen-switcher-row-btn--danger"
									onclick={() => deleteScreen(screen.id, screen.name)}
									title="Delete screen"
									aria-label="Delete screen"
									disabled={screens.length <= 1}
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/each}

			<div class="gm-screen-switcher-sep"></div>

			{#if editing === "create"}
				<input
					class="gm-input gm-screen-switcher-input"
					bind:this={inputEl}
					bind:value={nameDraft}
					onkeydown={onKeydown}
					onblur={commitEdit}
					placeholder="New screen name"
					spellcheck="false"
				/>
			{:else if editing === "paste"}
				<textarea
					class="gm-input gm-screen-switcher-paste"
					bind:this={pasteEl}
					bind:value={pasteDraft}
					placeholder="Paste screen JSON…"
					spellcheck="false"
				></textarea>
				<div class="gm-screen-switcher-paste-actions">
					<button class="gm-toolbar-btn" onclick={cancelEdit}>Cancel</button>
					<button class="gm-toolbar-btn gm-toolbar-btn--active" onclick={commitPaste}>Import</button>
				</div>
			{:else}
				<button class="gm-screen-switcher-item" onclick={startCreate}>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					<span class="gm-screen-switcher-item-name">New screen…</span>
				</button>

				<div class="gm-screen-switcher-sep"></div>
				<div class="gm-screen-switcher-label">Export</div>
				<button class="gm-screen-switcher-item" onclick={exportToFile}>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
					<span class="gm-screen-switcher-item-name">Download as file</span>
				</button>
				<button class="gm-screen-switcher-item" onclick={exportToClipboard}>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
					<span class="gm-screen-switcher-item-name">Copy to clipboard</span>
				</button>

				<div class="gm-screen-switcher-sep"></div>
				<div class="gm-screen-switcher-label">Import</div>
				<button class="gm-screen-switcher-item" onclick={importFromFile}>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
					<span class="gm-screen-switcher-item-name">From file…</span>
				</button>
				<button class="gm-screen-switcher-item" onclick={startPaste}>
					<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
					<span class="gm-screen-switcher-item-name">Paste JSON…</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
