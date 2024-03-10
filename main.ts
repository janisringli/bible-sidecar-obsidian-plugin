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

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class BibleSidecar extends Plugin {
	settings: MyPluginSettings;
	private view: BibleView;
	async onload() {
		await this.loadSettings();

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

		// Perform additional things with the ribbon
		ribbonIconEl.addClass("my-plugin-ribbon-class");

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
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

class SampleSettingTab extends PluginSettingTab {
	plugin: BibleSidecar;

	constructor(app: App, plugin: BibleSidecar) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
