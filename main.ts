import {
	Plugin,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";

// Remember to rename these classes and interfaces!

interface BibleSidecarSettings {
	bibleVersion: string;
	copyFormat: string;
	copyVerseReference: boolean;
	verseReferenceStyle: string;
	verseReferenceFormat: string;
	verseReferenceInternalLinking: boolean;
	verseReferenceInternalLinkingFormat: string;
	bibleLanguage: string;

}

const DEFAULT_SETTINGS: Partial<BibleSidecarSettings> = {
	bibleVersion: "NLT",
	copyFormat: "plain",
	copyVerseReference: false,
	verseReferenceStyle: "- ",
	verseReferenceFormat: "full",
	verseReferenceInternalLinking: false,
	verseReferenceInternalLinkingFormat:"short",
	bibleLanguage: "en",


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
		this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			(evt: MouseEvent) => {
				// Called when the user clicks the icon.
				// open new view
				this.toggleBibleSidecarView();
			}
		);
		this.addCommand({
			id: "open-bible-sidecar",
			name: "Open Bible Sidecar",
			callback: this.toggleBibleSidecarView,
			icon: "book-open-text",
		});
		this.initLeaf();

	}
	private readonly toggleBibleSidecarView = async (): Promise<void> => {
		const existing = this.app.workspace.getLeavesOfType(BibleViewType);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const rightLeaf = this.app.workspace.getRightLeaf(false);
		if (rightLeaf) {
			await rightLeaf.setViewState({
				type: BibleViewType,
				active: true,
			});
		}

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
