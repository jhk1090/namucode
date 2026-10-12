import * as vscode from "vscode";
import { cache, linkQuery } from '../parser';

export class LinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
		const tree = cache.get(document.uri.toString())?.tree;
		
		if (!tree) {
			return [];
		}

		const result = []
		for (const { name, node } of linkQuery.captures(tree.rootNode)) {
			if (name === "link") {
				if (node.children.find(child => child.type === "argument")) continue;

				const startPos = document.positionAt(node.startIndex);
				const endPos = document.positionAt(node.endIndex);
				const linkRange = new vscode.Range(startPos, endPos);

				const isExternalLink = /^(http(s)?|ftp)/.test(node.text);
				result.push(new vscode.DocumentLink(linkRange, vscode.Uri.parse(isExternalLink ? node.text : "https://namu.wiki/w/" + node.text)))
				continue;
			}
			if (name === "macro") {
				const macroContent = node.namedChild(2);
				const firstArgument = macroContent?.namedChild(0);
	
				if (firstArgument?.type === "macro_argument") {
					const startPos = document.positionAt(firstArgument.startIndex);
					const endPos = document.positionAt(firstArgument.endIndex);
					const linkRange = new vscode.Range(startPos, endPos);
	
					result.push(new vscode.DocumentLink(linkRange, vscode.Uri.parse("https://namu.wiki/w/" + firstArgument.text)))
				}
				continue;
			}
		}

		return result;
	}
}