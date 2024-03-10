import {
	ItemView,
	WorkspaceLeaf,
	requestUrl,
	App,
	
} from "obsidian";

export const BibleViewType = "bible-view";

export class BibleView extends ItemView {
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
		this.loadBible();
	}

	async onOpen() {
		const url = "https://bolls.life/get-books/NLT";
		const response = await requestUrl(url);

		console.log(response.json);
		

		

		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Bible View" });
		const dropdownContainerEl = containerEl.createEl("div", {cls:"dropdown-container" });
		const dropdownBook = dropdownContainerEl.createEl("select", { attr: { id: "books" } });
		for (const book of response.json) {
			console.log(book.name);
			dropdownBook.createEl("option", { text: book.name });
		}
		const dropdownChapter = dropdownContainerEl.createEl("select", { attr: { id: "chapters" } });
		
	}
	async loadBible() {
		//const { contentEl } = this;
		
	}
	public getChapter(selectedBook: string) {
		console.log(selectedBook);
	}
}
