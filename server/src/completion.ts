import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionContext, CompletionItem, CompletionList } from 'vscode-languageserver/node';
import { cache } from './parser';
import { cssLanguageService } from './diagnostics';

export function provideCompletion(document: TextDocument, position: Position, context: CompletionContext): CompletionList | CompletionItem[] {
	const tree = cache.get(document.uri.toString())?.tree;
	if (!tree) return [];

	const positionIndex = document.offsetAt(position);
	const node = tree.rootNode.descendantForIndex(positionIndex);
	if (!node) return []
	
	if (node.type === "block_header" && node.parent.type === "wiki_block") {
		const regex = /(style|dark-style|lang|class|tag|onclick)="([^"]*)(")?/g;

		const matches = [...node.text.matchAll(regex)].map(match => ({
				name: match[1],
				value: match[2],
				endToken: match[3],
				startIndex: node.startIndex + match.index,
				endIndex: node.startIndex + match.index + match[0].length,
				valueStartIndex: node.startIndex + match.index! + match[0].indexOf(match[2]),
		}));

		const targetMatch = matches.find(match => match.startIndex <= positionIndex && positionIndex <= match.endIndex);
		if (!targetMatch) return [];
		if (targetMatch.name !== "style" && targetMatch.name !== "dark-style") return [];

		const prefix = ".i{"
		const suffix = "}"
		const virtualText = `${prefix}${targetMatch.value}${suffix}`
		const virtualDoc = TextDocument.create(
			'namucode-virtual://embedded.css',
			'css',
			document.version,
			virtualText
		);

		const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
		const relativeOffset = positionIndex - targetMatch.valueStartIndex + prefix.length;
		const virtualPosition = virtualDoc.positionAt(
				Math.max(0, Math.min(relativeOffset, virtualText.length))
		);

		const result = cssLanguageService.doComplete(virtualDoc, virtualPosition, stylesheet);

		for (const item of result.items) {
			const edit = item.textEdit;

			if (edit && "range" in edit) {
				const start = virtualDoc.offsetAt(edit.range.start)
				const end = virtualDoc.offsetAt(edit.range.end)

				item.textEdit = {
					range: {
						start: document.positionAt(targetMatch.valueStartIndex + start - prefix.length),
						end: document.positionAt(targetMatch.valueStartIndex + end  - prefix.length)
					},
					newText: edit.newText
				}
			}
		}

		return result;
	}
	else if (node.type === "nowiki_content" && node.parent.type === "style_block") {
		let virtualText = node.text
		virtualText = virtualText.replace(/@theseed-dark-mode/g, '@media all and (n)')
		const virtualDoc = TextDocument.create(
			'namucode-virtual://embedded.css',
			'css',
			document.version,
			virtualText
		);

		const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
		const relativeOffset = positionIndex - node.startIndex;
		const virtualPosition = virtualDoc.positionAt(relativeOffset);

		const result = cssLanguageService.doComplete(virtualDoc, virtualPosition, stylesheet);

		for (const item of result.items) {
			const edit = item.textEdit;

			if (edit && "range" in edit) {
				const start = virtualDoc.offsetAt(edit.range.start)
				const end = virtualDoc.offsetAt(edit.range.end)

				item.textEdit = {
					range: {
						start: document.positionAt(node.startIndex + start),
						end: document.positionAt(node.startIndex + end)
					},
					newText: edit.newText
				}
			}
		}

		return result;
	}

	return []
}