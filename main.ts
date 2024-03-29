import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";

// Remember to rename these classes and interfaces!

interface BibleSidecarSettings {
	bibleVersion: string;
}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",
};

export default class BibleSidecarPlugin extends Plugin {
	settings: BibleSidecarSettings;
	private view: BibleView;
	async onload() {
		await this.loadSettings();
		console.log(this.settings.bibleVersion);
		this.addSettingTab(new BibleSidecarSettingsTab(this.app, this));
		this.registerView(
			BibleViewType,
			(leaf: WorkspaceLeaf) => (this.view = new BibleView(leaf))
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				// open new view
				new Notice("wait that actually worked!");
				console.log("markdown view found");
				this.toggleBibleSidecarView();
				new Notice("This is a notice!");
			}
		);

	}
	private readonly toggleBibleSidecarView = async (): Promise<void> => {
		const existing = this.app.workspace.getLeavesOfType(BibleViewType);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: BibleViewType,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(BibleViewType)[0]
		);
	};

	initLeaf(): void {
		if (this.app.workspace.getLeavesOfType(BibleViewType).length) {
			console.log("Bible view already open");
			return;
		}
	}
	onunload() {
		this.app.workspace
			.getLeavesOfType(BibleViewType)
			.forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
