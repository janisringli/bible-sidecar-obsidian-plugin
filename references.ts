export interface BibleBookAlias {
	canon: string;
	abbreviations: string[];
	chapters: number;
	order: number;
}

export interface BibleReference {
	canon: string;
	chapter: number;
	chapters: number;
	order: number;
	vStart: number | null;
	vEnd: number | null;
	ref: string;
}

interface AliasEntry {
	canon: string;
	chapters: number;
	order: number;
}

const BOOKS: Array<[string, string[], number]> = [
	["Genesis", ["Gen", "Ge", "Gn"], 50],
	["Exodus", ["Exod", "Exo", "Ex"], 40],
	["Leviticus", ["Lev", "Lv"], 27],
	["Numbers", ["Num", "Nm", "Nb"], 36],
	["Deuteronomy", ["Deut", "Deu", "Dt"], 34],
	["Joshua", ["Josh", "Jos", "Jsh"], 24],
	["Judges", ["Judg", "Jdg", "Jg"], 21],
	["Ruth", ["Rth", "Ru"], 4],
	["1 Samuel", ["1 Sam", "1Sa", "1 Sm"], 31],
	["2 Samuel", ["2 Sam", "2Sa", "2 Sm"], 24],
	["1 Kings", ["1 Kgs", "1 Ki", "1Kin"], 22],
	["2 Kings", ["2 Kgs", "2 Ki", "2Kin"], 25],
	["1 Chronicles", ["1 Chr", "1 Chron", "1Ch"], 29],
	["2 Chronicles", ["2 Chr", "2 Chron", "2Ch"], 36],
	["Ezra", ["Ezr"], 10],
	["Nehemiah", ["Neh", "Ne"], 13],
	["Esther", ["Est", "Esth"], 10],
	["Job", ["Jb"], 42],
	["Psalms", ["Psalm", "Pslm", "Psa", "Ps", "Pss"], 150],
	["Proverbs", ["Prov", "Prv", "Pro"], 31],
	["Ecclesiastes", ["Eccles", "Eccl", "Ecc", "Qoh"], 12],
	["Song of Solomon", ["Song of Songs", "Song", "SOS", "Canticles"], 8],
	["Isaiah", ["Isa", "Is"], 66],
	["Jeremiah", ["Jer", "Je"], 52],
	["Lamentations", ["Lam", "La"], 5],
	["Ezekiel", ["Ezek", "Eze", "Ezk"], 48],
	["Daniel", ["Dan", "Dn"], 12],
	["Hosea", ["Hos", "Ho"], 14],
	["Joel", ["Joe", "Jl"], 3],
	["Amos", ["Am"], 9],
	["Obadiah", ["Obad", "Oba", "Ob"], 1],
	["Jonah", ["Jon", "Jnh"], 4],
	["Micah", ["Mic", "Mc"], 7],
	["Nahum", ["Nah", "Na"], 3],
	["Habakkuk", ["Hab", "Hb"], 3],
	["Zephaniah", ["Zeph", "Zep", "Zp"], 3],
	["Haggai", ["Hag", "Hg"], 2],
	["Zechariah", ["Zech", "Zec", "Zc"], 14],
	["Malachi", ["Mal", "Ml"], 4],
	["Matthew", ["Matt", "Mat", "Mt"], 28],
	["Mark", ["Mrk", "Mar", "Mk"], 16],
	["Luke", ["Luk", "Lk"], 24],
	["John", ["Jhn", "Jn"], 21],
	["Acts", ["Act", "Ac"], 28],
	["Romans", ["Rom", "Ro", "Rm"], 16],
	["1 Corinthians", ["1 Cor", "1 Co"], 16],
	["2 Corinthians", ["2 Cor", "2 Co"], 13],
	["Galatians", ["Gal", "Ga"], 6],
	["Ephesians", ["Eph", "Ephes"], 6],
	["Philippians", ["Phil", "Php", "Pp"], 4],
	["Colossians", ["Col", "Co"], 4],
	["1 Thessalonians", ["1 Thess", "1 Thes", "1 Th"], 5],
	["2 Thessalonians", ["2 Thess", "2 Thes", "2 Th"], 3],
	["1 Timothy", ["1 Tim", "1 Ti"], 6],
	["2 Timothy", ["2 Tim", "2 Ti"], 4],
	["Titus", ["Tit", "Ti"], 3],
	["Philemon", ["Philem", "Phlm", "Phm"], 1],
	["Hebrews", ["Heb"], 13],
	["James", ["Jas", "Jm"], 5],
	["1 Peter", ["1 Pet", "1 Pe", "1 Pt"], 5],
	["2 Peter", ["2 Pet", "2 Pe", "2 Pt"], 3],
	["1 John", ["1 Jhn", "1 Jn"], 5],
	["2 John", ["2 Jhn", "2 Jn"], 1],
	["3 John", ["3 Jhn", "3 Jn"], 1],
	["Jude", ["Jud", "Jd"], 1],
	["Revelation", ["Rev", "Re", "Apocalypse"], 22],
];

const ROMAN_NUMERALS: Record<string, string> = {
	"1": "I",
	"2": "II",
	"3": "III",
};

const aliasMap = new Map<string, AliasEntry>();
const surfaceAliases: string[] = [];

const normalizeAlias = (value: string): string =>
	value.toLowerCase().replace(/\s+/g, "").replace(/\./g, "");

const escapeRegex = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

BOOKS.forEach(([canon, abbreviations, chapters], index) => {
	const order = index + 1;
	const surfaces = new Set([canon, ...abbreviations]);
	for (const surface of [canon, ...abbreviations]) {
		const numberedMatch = surface.match(/^([123])\s*(.*)$/);
		if (numberedMatch) {
			surfaces.add(`${ROMAN_NUMERALS[numberedMatch[1]]} ${numberedMatch[2]}`);
		}
	}
	for (const surface of surfaces) {
		surfaceAliases.push(surface);
		aliasMap.set(normalizeAlias(surface), { canon, chapters, order });
	}
});

surfaceAliases.sort((left, right) => right.length - left.length);

const BOOK_PART = surfaceAliases
	.map((surface) => escapeRegex(surface).replace(/ /g, "\\s*"))
	.join("|");

const REF_PATTERN = `(${BOOK_PART})\\.?\\s*(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-\\u2013\\u2014]\\s*(\\d{1,3}))?)?`;

export const BIBLE_REFERENCE_CLASS = "bible-sidecar-ref";

export function createBibleReferenceRegex(): RegExp {
	return new RegExp(REF_PATTERN, "g");
}

export function parseBibleReferenceMatch(match: RegExpExecArray): BibleReference | null {
	const alias = match[1];
	const chapterText = match[2];
	if (!alias || !chapterText) {
		return null;
	}

	const entry = aliasMap.get(normalizeAlias(alias));
	if (!entry) {
		return null;
	}

	const chapter = Number.parseInt(chapterText, 10);
	if (!Number.isInteger(chapter) || chapter < 1 || chapter > entry.chapters) {
		return null;
	}

	const vStart = match[3] ? Number.parseInt(match[3], 10) : null;
	const vEnd = match[4] ? Number.parseInt(match[4], 10) : null;
	let ref = `${entry.canon} ${chapter}`;
	if (vStart !== null) {
		ref += `:${vStart}`;
		if (vEnd !== null) {
			ref += `-${vEnd}`;
		}
	}

	return {
		canon: entry.canon,
		chapter,
		chapters: entry.chapters,
		order: entry.order,
		vStart,
		vEnd,
		ref,
	};
}

export function createBibleReferenceSpan(display: string, reference: BibleReference): HTMLElement {
	const span = document.createElement("span");
	span.className = BIBLE_REFERENCE_CLASS;
	span.textContent = display;
	span.setAttribute("role", "link");
	span.tabIndex = 0;
	writeReferenceDataset(span, reference);
	return span;
}

export function readBibleReferenceFromElement(element: Element): BibleReference | null {
	if (!(element instanceof HTMLElement)) {
		return null;
	}
	const { dataset } = element;
	if (!dataset.ref || !dataset.canon || !dataset.chapter || !dataset.chapters || !dataset.order) {
		return null;
	}

	return {
		canon: dataset.canon,
		chapter: Number.parseInt(dataset.chapter, 10),
		chapters: Number.parseInt(dataset.chapters, 10),
		order: Number.parseInt(dataset.order, 10),
		vStart: dataset.vstart ? Number.parseInt(dataset.vstart, 10) : null,
		vEnd: dataset.vend ? Number.parseInt(dataset.vend, 10) : null,
		ref: dataset.ref,
	};
}

export function writeReferenceDataset(element: HTMLElement, reference: BibleReference): void {
	element.dataset.canon = reference.canon;
	element.dataset.chapter = String(reference.chapter);
	element.dataset.chapters = String(reference.chapters);
	element.dataset.order = String(reference.order);
	element.dataset.ref = reference.ref;
	if (reference.vStart !== null) {
		element.dataset.vstart = String(reference.vStart);
	}
	if (reference.vEnd !== null) {
		element.dataset.vend = String(reference.vEnd);
	}
}

export function getBibleBookOrder(canon: string): number | null {
	return aliasMap.get(normalizeAlias(canon))?.order || null;
}

export function processBibleReferencesInElement(root: HTMLElement): void {
	const skippedTags = new Set(["A", "CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			if (!node.nodeValue || !/\d/.test(node.nodeValue)) {
				return NodeFilter.FILTER_REJECT;
			}

			let parent = node.parentElement;
			while (parent && parent !== root) {
				if (skippedTags.has(parent.tagName) || parent.classList.contains(BIBLE_REFERENCE_CLASS)) {
					return NodeFilter.FILTER_REJECT;
				}
				parent = parent.parentElement;
			}
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	const targets: Text[] = [];
	let node = walker.nextNode();
	while (node) {
		if (node instanceof Text) {
			targets.push(node);
		}
		node = walker.nextNode();
	}

	for (const textNode of targets) {
		replaceReferencesInTextNode(textNode);
	}
}

function replaceReferencesInTextNode(node: Text): void {
	const text = node.nodeValue;
	if (!text) {
		return;
	}

	const regex = createBibleReferenceRegex();
	let match = regex.exec(text);
	let lastIndex = 0;
	let fragment: DocumentFragment | null = null;

	while (match) {
		const reference = parseBibleReferenceMatch(match);
		if (reference) {
			if (!fragment) {
				fragment = document.createDocumentFragment();
			}
			if (match.index > lastIndex) {
				fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
			}
			fragment.appendChild(createBibleReferenceSpan(match[0], reference));
			lastIndex = match.index + match[0].length;
		}
		match = regex.exec(text);
	}

	if (!fragment || !node.parentNode) {
		return;
	}
	if (lastIndex < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
	}
	node.parentNode.replaceChild(fragment, node);
}
