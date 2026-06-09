<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from "svelte";
	import type { Component } from "obsidian";
	import type { ScreenCard, ScreenLayout } from "../core/cards/card-types";
	import { GridLayoutAdapter } from "../core/layout/GridLayoutAdapter";
	import type { GMScreenController } from "./controller";
	import CardShell from "./CardShell.svelte";
	import CardSettingsModal from "./components/CardSettingsModal.svelte";

	const { controller, hostComponent, layoutLocked = false, editMode = false }: {
		controller: GMScreenController;
		hostComponent: Component;
		layoutLocked?: boolean;
		editMode?: boolean;
	} = $props();

	let layout: ScreenLayout | null = $state(untrack(() => controller.getActiveLayout()));
	let gridEl: HTMLDivElement = $state(null!);
	let gridAdapter: GridLayoutAdapter | null = $state(null);
	let configModalCard: ScreenCard | null = $state(null);

	const unsubscribe = untrack(() => controller.layoutStore.subscribe((value) => {
		layout = value;
		void syncGrid();
	}));

	async function syncGrid(): Promise<void> {
		if (!gridAdapter || !layout) {
			return;
		}
		await tick();
		gridAdapter.sync(layout.cards);
	}

	onMount(() => {
		gridAdapter = new GridLayoutAdapter(gridEl, (changes) => {
			for (const change of changes) {
				controller.updateCardPosition(change.id, change.x, change.y, change.w, change.h);
			}
		});
		gridAdapter.init();
		gridAdapter.setLocked(layoutLocked);
		void syncGrid();
	});

	$effect(() => {
		if (gridAdapter) {
			gridAdapter.setLocked(layoutLocked);
		}
	});

	onDestroy(() => {
		unsubscribe();
		gridAdapter?.destroy();
	});

	function removeCard(cardId: string): void {
		controller.removeCard(cardId);
	}

	function openSettings(card: ScreenCard): void {
		configModalCard = card;
	}

	function closeSettings(): void {
		configModalCard = null;
	}

	function saveCardConfig(value: unknown): void {
		if (!configModalCard) {
			return;
		}
		controller.updateCardConfig(configModalCard.id, configModalCard.type, value);
	}

	function getCardTitle(type: string): string {
		return controller.cardRegistry.get(type as never).name;
	}

	function getCardComponent(type: string): any {
		return controller.cardRegistry.get(type as never).component;
	}
</script>

<div class="gm-screen-grid-wrapper">
	<div class="grid-stack gm-screen-grid" bind:this={gridEl}>
		{#if layout}
			{#each layout.cards as card (card.id)}
				<div class="grid-stack-item" data-card-id={card.id}>
					<div class="grid-stack-item-content">
							<CardShell
								title={getCardTitle(card.type)}
								{editMode}
								onRemove={() => removeCard(card.id)}
								onEdit={() => openSettings(card)}
							>
								{@const CardComponent = getCardComponent(card.type)}
								<CardComponent
									{card}
									{controller}
									{hostComponent}
									{editMode}
								/>
							</CardShell>
						</div>
					</div>
			{/each}
		{/if}
	</div>
</div>

{#if configModalCard}
	<CardSettingsModal
		title={`Edit ${getCardTitle(configModalCard.type)} config`}
		config={configModalCard.config}
		onSave={saveCardConfig}
		onClose={closeSettings}
	/>
{/if}
