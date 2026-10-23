import { DocumentSymbol, DocumentSymbolParams, Range, SymbolKind } from 'vscode-languageserver';
import { parserCache, documentSymbolQuery } from './parser';
import { Node } from 'web-tree-sitter';

interface TreeSymbol extends DocumentSymbol {
	depth: number;
}

let headings = [0, 0, 0, 0, 0, 0];
let startOffset = 0;

function makeDocumentSymbol(node: Node, isRoot: boolean = false) {
	const result: TreeSymbol[] = [];
	const sections = node.children.filter(child => child.type === "section" && child.children.find(subchild => subchild.type === "heading"))
	if (isRoot) {
		headings = [0, 0, 0, 0, 0, 0];
		startOffset = Math.min(...sections.map(section => parseInt(section.firstChild.firstChild.type.at(-1)))) - 1;
	}

	for (const section of sections) {
		const headingNode = section.firstChild.firstChild;

		const contentNode = headingNode.childForFieldName("content")
		const level = parseInt(headingNode.type.at(-1))

		headings.fill(0, level);
		headings[level - 1]++;
		
		let currentHeadings = [...headings];
		while (currentHeadings.at(-1) === 0) {
			currentHeadings.pop()
		}
		
		const text = documentSymbolQuery.matches(contentNode).map(match => {
			const { node, name } = match.captures[0]
			if (name === "text_inline") return node.text
			return node.text.at(-1)
		}).join("");

		const name = currentHeadings.slice(startOffset).join(".") + ". " + text;
		const range = Range.create(
			{ line: headingNode.startPosition.row, character: headingNode.startPosition.column },
			{ line: headingNode.endPosition.row, character: headingNode.endPosition.column },
		)

		result.push({
			depth: level,
			kind: SymbolKind.String,
			name,
			range,
			selectionRange: range,
			children: makeDocumentSymbol(section)
		})
	}

	return result
}

export function provideDocumentSymbol(params: DocumentSymbolParams) {
	const tree = parserCache.get(params.textDocument.uri)?.tree;
	if (!tree) return [];
	
	return makeDocumentSymbol(tree.rootNode, true);
}