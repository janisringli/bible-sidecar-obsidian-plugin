import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";
import {
	BIBLE_REFERENCE_CLASS,
	createBibleReferenceRegex,
	parseBibleReferenceMatch,
	writeReferenceDataset,
} from "./references";

export function buildBibleReferenceEditorExtension() {
	const buildDecorations = (view: EditorView): DecorationSet => {
		const builder = new RangeSetBuilder<Decoration>();
		for (const { from, to } of view.visibleRanges) {
			const text = view.state.doc.sliceString(from, to);
			const regex = createBibleReferenceRegex();
			let match = regex.exec(text);
			while (match) {
				const reference = parseBibleReferenceMatch(match);
				if (reference) {
					const start = from + match.index;
					const end = start + match[0].length;
					const span = document.createElement("span");
					writeReferenceDataset(span, reference);
					builder.add(
						start,
						end,
						Decoration.mark({
							class: BIBLE_REFERENCE_CLASS,
							attributes: {
								role: "link",
								"data-canon": span.dataset.canon || "",
								"data-chapter": span.dataset.chapter || "",
								"data-chapters": span.dataset.chapters || "",
								"data-order": span.dataset.order || "",
								"data-ref": span.dataset.ref || "",
								"data-vstart": span.dataset.vstart || "",
								"data-vend": span.dataset.vend || "",
							},
						})
					);
				}
				match = regex.exec(text);
			}
		}
		return builder.finish();
	};

	return ViewPlugin.fromClass(
		class BibleReferenceDecorationPlugin {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view);
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(update.view);
				}
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
		}
	);
}
