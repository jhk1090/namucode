import { ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { flattenSymbols } from '../extension';
import { DocumentSymbolProvider } from './DocumentSymbolProvider';

export class FoldingRangeProvider implements vscode.FoldingRangeProvider {
  constructor(private context: ExtensionContext) { }

  async provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): Promise<vscode.FoldingRange[]> {
    // console.log("folding", decodeURIComponent(path.basename(document.uri.path)))
    const ranges = [];

    const rootConfig = vscode.workspace.getConfiguration("namucode");
		const maxParsingDepth = rootConfig.get<number>("parser.maxParsingDepth", 30);
		const maxCharacter = rootConfig.get<number>("parser.maxParsingCharacter", 1500000);

    const result = await DocumentSymbolProvider.createParserPromise(document, { editorComment: false, maxParsingDepth, maxCharacter })

    const singleDepthTypes = ["scaleText", "colorText"]
		const targetDepthTypes = [...singleDepthTypes, "wikiSyntax", "folding", "ifSyntax"]
		const targetFlatTypes = ["syntaxSyntax", "htmlSyntax", "literal"]
    const specialTypes = ["paragraph", "heading", "table", "link"]

    const allTypes = [...targetDepthTypes, ...targetFlatTypes, ...specialTypes]

		const findTargetTypes = (array, startLine) => {
      if (array.length === undefined) {
        findTargetTypes([array], startLine);
        return;
      }

      for (const element of array) {
        if (!allTypes.includes(element.type)) continue

        if (targetDepthTypes.includes(element.type)) {
          const tokStartLine = startLine + element.startLine - 1;
          const tokEndLine = startLine + element.endLine - 2;
          element.content = element.content ?? [];
          if (tokStartLine < tokEndLine) {
            ranges.push(new vscode.FoldingRange(tokStartLine, tokEndLine));
            for (const content of element.content) {
              findTargetTypes(content, singleDepthTypes.includes(element.type) ? tokStartLine : tokStartLine + 1);
            }
          }
          continue;
        }
        if (targetFlatTypes.includes(element.type)) {
          const tokStartLine = startLine + element.startLine - 1;
          const tokEndLine = startLine + element.endLine - 2;
          ranges.push(new vscode.FoldingRange(tokStartLine, tokEndLine));
          continue;
        }
        if (element.type === "paragraph") {
          for (const line of element.lines ?? []) {
            findTargetTypes(line, startLine);
          }
          continue;
        }
        if (element.type === "heading") {
          // heading은 상위에서만 적용됨: startLine == 0
          findTargetTypes(element.content, startLine);
          continue;
        }
        if (element.type === "table") {
          for (const row of element.rows) {
            for (const column of row) {
              findTargetTypes(column.value ?? [], startLine + column.startLine - 1);
            }
          }
        }
        if (element.type === "link") {
          findTargetTypes(element.parsedText ?? [], startLine + element.startLine - 1);
        }
      }
    };
    
    // let parseStart = performance.now();
    try {
      findTargetTypes(result.result, 0)
    } catch (e) {
      console.error(e)
    }
    // let parseEnd = performance.now();
    // console.log("[Folding] ", "(time: ", (parseEnd - parseStart).toFixed(2), "ms)")

    const headings = result.data.headings
    for (let index = 0; index < headings.length; index++) {
      const heading = headings[index];
      const nextHeading = headings[index + 1];

      const startLine = heading.line - 1;
      const endLine = nextHeading ? nextHeading.line - 2 : document.lineCount - 1;

      ranges.push(new vscode.FoldingRange(startLine, endLine))
    }

    return ranges;
  }
}
