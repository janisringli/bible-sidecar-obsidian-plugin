import {
	Plugin,
	WorkspaceLeaf,
} from "obsidian";
import { BibleView, BibleViewType } from "BibleView";
import { BibleSidecarSettingsTab } from "./settings";

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
	verseReferenceInternalLinkingFormat: "short",
	bibleLanguage: "en",
};

const LANGUAGE_DEFAULT_VERSIONS: Record<string, string> = {
	en: "NLT",
	de: "ELB",
	fr: "NBS",
	es: "BTX3",
	pt: "ARA",
	it: "NR06",
	nl: "NLD",
	ru: "SYNOD",
	ar: "SVD",
	in: "TB",
};

export default class BibleSidecarPlugin extends Plugin {
	settings: BibleSidecarSettings;
	private view: BibleView | undefined;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BibleSidecarSettingsTab(this.app, this));

		this.registerView(
			BibleViewType,
			(leaf: WorkspaceLeaf) => {
				const view = new BibleView(leaf);
				this.view = view;
				view.settings = this.settings;
				return view;
			}
		);

		this.addRibbonIcon(
			"book-open-text",
			"Bible Sidecar",
			(evt: MouseEvent) => {
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

	updateBibleViewSettings = (newSettings: BibleSidecarSettings) => {
		if (this.view) {
			this.view.updateSettings(newSettings);
		}
	};

	async loadSettings() {
		await this.loadData().then((data) => {
			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				data,
				{
					bibleVersion:
						data?.bibleLanguage &&
						LANGUAGE_DEFAULT_VERSIONS[data.bibleLanguage]
							? LANGUAGE_DEFAULT_VERSIONS[data.bibleLanguage]
							: LANGUAGE_DEFAULT_VERSIONS["en"], // Default to "en" if not found
				}
			);
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
		console.log("Saved settings", this.settings);
		this.updateBibleViewSettings(this.settings);
	}
}