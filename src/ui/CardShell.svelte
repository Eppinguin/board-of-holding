<script lang="ts">
	import type { Snippet } from "svelte";

	const { title, editMode = false, onRemove, onEdit, children }: {
		title: string;
		editMode?: boolean;
		onRemove: () => void;
		onEdit: () => void;
		children: Snippet;
	} = $props();
</script>

<div class="gm-screen-card" class:gm-screen-card--edit={editMode}>
	{#if editMode}
		<div class="gm-screen-card-header">
			<span class="gm-screen-card-title">{title}</span>
			<div class="gm-screen-card-actions">
				<button class="gm-card-icon-btn" title="Card settings" onclick={onEdit}>
					<!-- settings / sliders icon -->
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
				</button>
				<button class="gm-card-icon-btn gm-card-icon-btn--danger" title="Remove card" onclick={onRemove}>
					<!-- x icon -->
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		</div>
	{/if}
	<div class="gm-screen-card-body">
		{@render children()}
	</div>
</div>
