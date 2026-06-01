import * as vscode from "vscode"

export class TableSnippetProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken,
      context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
      const linePrefix = document.lineAt(position).text.substring(0, position.character);
      const match = linePrefix.match(/(?:^|\s)table([1-9]|[1-4][0-9]|50)\*([1-9]|[1-4][0-9]|50)$/);

      if (match) {
        const rows = parseInt(match[1]);
        const cols = parseInt(match[2]);

        let snippetText = "";
        let tabStopIndex = 1;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            snippetText += `|| \${${tabStopIndex++}:내용} `;
          }
          snippetText += "||\n";
        }

        const item = new vscode.CompletionItem(`table${rows}*${cols}`, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(snippetText);
        item.detail = `${rows}행 ${cols}열 표 삽입`;

        const matchText = match[0].trimStart();
        const matchStart = position.character - matchText.length;
        item.range = new vscode.Range(position.line, matchStart, position.line, position.character);

        return [item];
      }
      return undefined;
    }
  }