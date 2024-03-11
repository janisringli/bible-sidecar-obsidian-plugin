import { ItemView, WorkspaceLeaf, requestUrl, App } from "obsidian";

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
	}

	async onOpen() {
		const url = "https://bolls.life/get-books/NLT";
		const response = await requestUrl(url);
		const { containerEl } = this;
		let scripture: string;

		containerEl.empty();
		containerEl.createEl("h2", { text: "Bible View" });
		const ChapterWrapper = containerEl.createEl("div", {
			cls: "bible-wrapper",
		});
		const chapterContainer = ChapterWrapper.createEl("div", {
			cls: "chapter-container",
		});
		for (const book of response.json) {
			console.log(book.name);
			chapterContainer
				.createEl("button", {
					text: book.name,
					attr: { id: book.bookid },
				})
				.addEventListener("click", async () => {
					chapterContainer.empty();
					for (let i = 1; i <= book.chapters; i++) {
						chapterContainer
							.createEl("button", {
								text: i.toString(),
								cls: "chapter-button",
							})
							.addEventListener("click", async () => {
								const chapterContent =
									await this.getChapterContent(
										book.bookid,
										i
									);
								chapterContainer.empty();
								chapterContainer.createEl("h2", {
									text: `${book.name} ${i}`,
								});
								for (const verse of chapterContent) {
									scripture += verse.verse + " ";
									console.log(scripture);
								}
								chapterContainer.createEl("p", {
									text: scripture,
								});
								// Now you can do whatever you want with the chapter content
							});
					}
				});
		}
	}

	async getChapterContent(bookid: number, chapter: number) {
		const url = `https://bolls.life/get-chapter/NLT/${bookid}/${chapter}`;
		console.log(url);
		const response = await requestUrl(url);
		console.log(response.json);
		return response.json;
	}
}
