import {
	ItemView,
	WorkspaceLeaf,
	requestUrl,
	Setting,
	PluginSettingTab,
} from "obsidian";

export const BibleViewType = "bible-view";

interface BibleViewSettings {
	settings: string;
}

const DEFAULT_SETTINGS: BibleViewSettings = {
	book: "Genesis",
	chapter: "1",
	translation: "NLT",
};
export class BibleView extends ItemView {
	settings: BibleViewSettings;
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return BibleViewType;
	}
	getDisplayText() {
		return "Bible Sidecar";
	}
	getIcon() {
		return "book-open-text";
	}
	public load(): void {
		super.load();
		this.contentEl.setText("Loading...");
		this.loadBible();
	}
	async onOpen() {
		const { contentEl } = this;
		const { containerEl } = this;
		const dropdown = containerEl.createEl("select");
		contentEl.empty();
		contentEl.createEl("h2", { text: "Bible View" });
		dropdown;
		dropdown.createEl("option", { text: "Genesis" });
		dropdown.createEl("option", { text: "Exodus" });
		dropdown.createEl("option", { text: "Leviticus" });
	}
	async loadBible() {
		//const { contentEl } = this;
		const url = "https://bolls.life/get-books/NLT";
		const response = await requestUrl(url);

		console.log(response.json);
		for (const book of response.json) {
			console.log(book.name);
		}
	}
}
