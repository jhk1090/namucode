import * as vscode from "vscode"
import { client } from './extension';

interface TreeSymbol {
	name: string;
	detail: string;
	kind: vscode.SymbolKind;
	range: vscode.Range;
	selectionRange: vscode.Range;
	depth: number;
  children: TreeSymbol[];
}
interface ParagraphTreeSymbol extends TreeSymbol {
  contentRange: vscode.Range;
}

const sanitizeName = (name: string) => name.split(". ").slice(1).join(". ")

let sortingFailedReason: string | null = null;
function attachContentRange(document: vscode.TextDocument, symbols: TreeSymbol[], lastLine: vscode.TextLine): ParagraphTreeSymbol[] {
  let result: ParagraphTreeSymbol[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const current = symbols[i]
    const next = symbols[i + 1]

    if (!next) {
      const contentRange = new vscode.Range(document.lineAt(current.range.start.line).range.start, lastLine.range.end)
      current.children = attachContentRange(document, current.children, lastLine)
      result.push({ ...current, contentRange } as ParagraphTreeSymbol)    
      break;
    }

    if (current.depth > next.depth) {
      sortingFailedReason = `${current.depth}단계 문단 "${current.name}"은/는 ${next.depth}단계 문단 "${next.name}"보다 선행될 수 없습니다. `;
      result = [];
      break;
    }

    const contentRange = new vscode.Range(document.lineAt(current.range.start.line).range.start, document.lineAt(next.range.start.line - 1).range.end)
    current.children = attachContentRange(document, current.children, document.lineAt(next.range.start.line - 1))
    result.push({ ...current, contentRange } as ParagraphTreeSymbol)
  }

  return result;
}
function sortTreeSymbols(symbols: ParagraphTreeSymbol[]): ParagraphTreeSymbol[] {
  symbols.sort((a, b) => sanitizeName(a.name).localeCompare(sanitizeName(b.name)));

  symbols.forEach((symbol) => {
    if (symbol.children && symbol.children.length > 0) {
      sortTreeSymbols(symbol.children as ParagraphTreeSymbol[]);
    }
  });

  return symbols;
}

export async function sortParagraph() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "namu") {
    vscode.window.showWarningMessage("이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.");
    return;
  }

  const documentSymbol = (await client.sendRequest("namucode/getDocumentSymbol", {
    uri: vscode.window.activeTextEditor.document.uri.toString(),
  })) as TreeSymbol[];
  if (documentSymbol.length === 0) {
    vscode.window.showErrorMessage(`문서 내에 문단이 없습니다.`);
    return;
  }

  const attachedDocumentSymbol = attachContentRange(editor.document, documentSymbol, editor.document.lineAt(editor.document.lineCount - 1));
  if (sortingFailedReason) {
    vscode.window.showErrorMessage(sortingFailedReason);
    return;
  }

  const splittedText = [];
  const startLine = attachedDocumentSymbol[0].contentRange.start.line;
  if (startLine > 0) {
    const topEmptyRange = new vscode.Range(editor.document.lineAt(0).range.start, editor.document.lineAt(startLine - 1).range.end);
    splittedText.push(editor.document.getText(topEmptyRange));
  }

  const sortedDocumentSymbol = sortTreeSymbols(attachedDocumentSymbol);
  
  function walkTree(nodes: ParagraphTreeSymbol[]) {
    nodes.forEach((node) => {
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        const topLineRange = editor.document.lineAt(node.contentRange.start.line).range
        splittedText.push(editor.document.getText(topLineRange))
        walkTree(node.children as ParagraphTreeSymbol[]);
      } else {
        splittedText.push(editor.document.getText(node.contentRange));
      }
    });
  }
  walkTree(sortedDocumentSymbol);

  const entireRange = new vscode.Range(
    editor.document.positionAt(0), // 문서 시작
    editor.document.positionAt(editor.document.getText().length), // 문서 끝
  );

  editor.edit((editBuilder) => {
    editBuilder.replace(entireRange, splittedText.join("\n"));
  });

  vscode.window.showInformationMessage("성공적으로 정렬되었습니다!");
}