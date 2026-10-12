import * as vscode from "vscode"
import { cache, foldingQuery } from '../parser'

export class FoldingProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
		const tree = cache.get(document.uri.toString())?.tree;
		const matches = foldingQuery.matches(tree.rootNode);

		const result = [];

		for (const match of matches) {
				const node = match.captures[0].node;
				const startLine = node.startPosition.row;
				const endLine = node.type === "section" ? node.endPosition.row : node.endPosition.row - 1;

				if (endLine - startLine < 1) {
						continue;
				}

				result.push(new vscode.FoldingRange(startLine, endLine));
		}

		return result;
	}
}