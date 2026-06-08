import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import App from "../ui/App.svelte";
import { GM_SCREEN_VIEW_TYPE } from "./constants";
import type { GMScreenViewModel } from "./GMScreenViewModel";

export class GMScreenView extends ItemView {
	private readonly viewModel: GMScreenViewModel;
	private svelteApp: object | null = null;

	constructor(leaf: WorkspaceLeaf, viewModel: GMScreenViewModel) {
		super(leaf);
		this.viewModel = viewModel;
	}

	getViewType(): string {
		return GM_SCREEN_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "GM Screen";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("gm-screen-view-root");

		await this.viewModel.loadInitialLayout();

		this.svelteApp = mount(App, {
			target: this.contentEl,
			props: {
				controller: this.viewModel,
				hostComponent: this
			}
		});
	}

	async onClose(): Promise<void> {
		if (this.svelteApp) {
			await unmount(this.svelteApp);
			this.svelteApp = null;
		}
		this.contentEl.empty();
	}
}
