import * as vscode from "vscode";
import { cache, linkQuery } from '../parser';

export class LinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
		const tree = cache.get(document.uri.toString())?.tree;
		
		if (!tree) {
			return [];
		}

		const result = []
		for (const { node: macro } of linkQuery.captures(tree.rootNode)) {
			const macroContent = macro.namedChild(2);
			const firstArgument = macroContent?.namedChild(0);

			if (firstArgument?.type === "macro_argument") {
				const startPos = document.positionAt(firstArgument.startIndex);
				const endPos = document.positionAt(firstArgument.endIndex);
				const linkRange = new vscode.Range(startPos, endPos);

				result.push(new vscode.DocumentLink(linkRange, vscode.Uri.parse(encodeURIComponent("https://namu.wiki/w/" + firstArgument.text))))
				firstArgument.startIndex
			}
		}

		return result;
	}
}