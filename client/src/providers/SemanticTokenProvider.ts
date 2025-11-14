import * as vscode from 'vscode';
import { DocumentSymbolProvider } from './DocumentSymbolProvider';

export const SemanticTokenLegend = new vscode.SemanticTokensLegend(
  ['heading']
);

export class SemanticTokenProvider implements vscode.DocumentSemanticTokensProvider {
  public async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
		const rootConfig = vscode.workspace.getConfiguration("namucode");
		const maxParsingDepth = rootConfig.get<number>("parser.maxParsingDepth", 30);
		const maxCharacter = rootConfig.get<number>("parser.maxParsingCharacter", 1500000);

		const result = await DocumentSymbolProvider.createParserPromise(document, { editorComment: false, maxParsingDepth, maxCharacter })
		const headings = result.data.headings

    const tokensBuilder = new vscode.SemanticTokensBuilder(SemanticTokenLegend);

		for (const heading of headings) {
			const line = heading.line - 1
			const lineRange = document.lineAt(line).range
			tokensBuilder.push(
          new vscode.Range(new vscode.Position(line, lineRange.start.character), new vscode.Position(line, lineRange.end.character)),
          'heading'
        );
		}

    return tokensBuilder.build();
  }
}