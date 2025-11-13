import { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { flattenSymbols } from '../extension';
import { DocumentSymbolProvider } from './DocumentSymbolProvider';

export class FoldingRangeProvider implements vscode.FoldingRangeProvider {
  constructor(private context: ExtensionContext) { }

  async provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): Promise<vscode.FoldingRange[]> {
    // console.log("folding", decodeURIComponent(path.basename(document.uri.path)))
    const symbolProvider = new DocumentSymbolProvider(this.context);
    const symbols = await symbolProvider.provideDocumentSymbols(document, token);

    const allSymbols = flattenSymbols(symbols);
    const ranges = [];

    for (let index = 0; index < allSymbols.length; index++) {
      const symbol = allSymbols[index];
      const nextSymbol = allSymbols[index + 1];

      const start = symbol.range.start.line;
      let end = -1;

      if (nextSymbol) {
        end = nextSymbol.range.start.line - 1;
      } else {
        end = document.lineCount - 1;
      }
      ranges.push(new vscode.FoldingRange(start, end));
    }

    return ranges;
  }
}
