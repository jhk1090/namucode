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
      sortingFailedReason = `"${current.name}"은/는 "${next.name}"보다 선행될 수 없어 정렬할 수 없습니다. `;
      result = [];
      break;
    }

    const contentRange = new vscode.Range(document.lineAt(current.range.start.line).range.start, document.lineAt(next.range.start.line - 1).range.end)
    current.children = attachContentRange(document, current.children, document.lineAt(next.range.start.line - 1))
    result.push({ ...current, contentRange } as ParagraphTreeSymbol)
  }

  return result;
}
function sortTreeSymbols(symbols: ParagraphTreeSymbol[], isSortingChildren: boolean, isAscending: boolean): ParagraphTreeSymbol[] {
  symbols.sort((a, b) => {
    return isAscending ? sanitizeName(a.name).localeCompare(sanitizeName(b.name)) : sanitizeName(b.name).localeCompare(sanitizeName(a.name));
  });

  if (isSortingChildren) {
    symbols.forEach((symbol) => {
      if (symbol.children && symbol.children.length > 0) {
        sortTreeSymbols(symbol.children as ParagraphTreeSymbol[], true, isAscending);
      }
    });
  }

  return symbols;
}

export async function sortParagraph() {
  sortingFailedReason = null;

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

  const rootItems: vscode.QuickPickItem[] = [
      {
          label: '$(replace-all) 문서 전체 정렬',
          detail: '문서에 있는 모든 문단을 정렬합니다.'
      },
      {
          label: '$(replace) 특정 문단 정렬',
          detail: '문서 내의 특정 문단을 선택해 정렬합니다.'
      }
  ];

  // 2. showQuickPick 호출
  const rootSelected = await vscode.window.showQuickPick(rootItems, {
      placeHolder: '수행할 작업을 선택하세요', // 입력창에 옅게 뜨는 힌트 문구
      matchOnDescription: true,             // description 검색 허용 여부
      matchOnDetail: true                    // detail 검색 허용 여부
  });

  if (!rootSelected) return

  let finalTarget = "";
  let finalSelectedSymbol: TreeSymbol;
  let finalSelectedSymbolNext: TreeSymbol;

  if (rootSelected.label.includes('특정')) {
    const flattenTree = (symbols: TreeSymbol[]): TreeSymbol[] => symbols.flatMap(node => [node, ...flattenTree(node.children)]);

    const flatSymbols = flattenTree(documentSymbol);
    const specificItems: vscode.QuickPickItem[] = flatSymbols.map(value => ({ label: value.name }))

    // 2. showQuickPick 호출
    const specificSelected = await vscode.window.showQuickPick(specificItems, {
        placeHolder: '정렬할 특정 문단을 선택하세요', // 입력창에 옅게 뜨는 힌트 문구
        matchOnDescription: true,             // description 검색 허용 여부
        matchOnDetail: true                    // detail 검색 허용 여부
    });

    if (!specificSelected) return

    finalTarget = specificSelected.label

    const symbolIndex = flatSymbols.findIndex(symbol => symbol.name === finalTarget)
    if (symbolIndex !== -1) {
      finalSelectedSymbol = flatSymbols[symbolIndex];
      const symbolNumbering = finalSelectedSymbol.name.split(" ")[0].split(".")
      for (let i = symbolIndex + 1; i < flatSymbols.length; i++) {
        const name = flatSymbols[i].name;
        const numbering = name.split(" ")[0].split(".")
        
        const remained = numbering.slice(symbolNumbering.length)
        if (remained.length === 0) {
          finalSelectedSymbolNext = flatSymbols[i];
          break;
        }
      }
    }
  }

  const finalItems: vscode.QuickPickItem[] =
    finalTarget === ""
      ? [
          {
            label: "$(check) 첫 번째 레벨 문단만 오름차순으로 정렬",
            detail: `첫 번째 레벨 문단끼리 A-Z 순서로 정렬합니다.`,
          },
          {
            label: "$(check-all) 모든 문단의 하위 문단까지 모두 오름차순으로 정렬",
            detail: `모든 문단에 대한 하위 문단끼리 A-Z 순서로 정렬합니다.`,
          },
          {
            label: "$(check) 첫 번째 레벨 문단만 내림차순으로 정렬",
            detail: `첫 번째 레벨 문단끼리 Z-A 순서로 정렬합니다.`,
          },
          {
            label: "$(check-all) 모든 문단의 하위 문단까지 모두 내림차순으로 정렬",
            detail: `모든 문단에 대한 하위 문단끼리 Z-A 순서로 정렬합니다.`,
          },
        ]
      : [
          {
            label: "$(check) 선택한 문단의 첫 번째 하위 문단만 오름차순으로 정렬",
            detail: `${finalTarget} 문단에 대한 첫 번째 하위 문단끼리 A-Z 순서로 정렬합니다.`,
          },
          {
            label: "$(check-all) 선택한 문단의 하위 문단 모두 오름차순으로 정렬",
            detail: `${finalTarget} 문단에 대한 모든 하위 문단을 A-Z 순서로 정렬합니다.`,
          },
          {
            label: "$(check) 선택한 문단의 첫 번째 하위 문단만 내림차순으로 정렬",
            detail: `${finalTarget} 문단에 대한 첫 번째 하위 문단끼리 Z-A 순서로 정렬합니다.`,
          },
          {
            label: "$(check-all) 선택한 문단의 하위 문단 모두 내림차순으로 정렬",
            detail: `${finalTarget} 문단에 대한 모든 하위 문단을 Z-A 순서로 정렬합니다.`,
          },
        ];

  const finalSelected = await vscode.window.showQuickPick(finalItems, {
      placeHolder: '수행할 작업을 선택하세요', // 입력창에 옅게 뜨는 힌트 문구
      matchOnDescription: true,             // description 검색 허용 여부
      matchOnDetail: true                    // detail 검색 허용 여부
  });

  if (!finalSelected) return

  const isSortingChildren = finalSelected.label.includes("$(check-all)")
  const isAscending = finalSelected.label.includes("오름차순")

  const attachedDocumentSymbol = attachContentRange(
    editor.document,
    finalSelectedSymbol?.children ?? documentSymbol,
    finalSelectedSymbol?.children && finalSelectedSymbolNext
      ? editor.document.lineAt(finalSelectedSymbolNext.range.start.line - 1)
      : editor.document.lineAt(editor.document.lineCount - 1),
  );
  if (sortingFailedReason) {
    vscode.window.showErrorMessage(sortingFailedReason);
    return;
  }
  if (attachedDocumentSymbol.length === 0) {
    vscode.window.showWarningMessage("아무 것도 정렬되지 않았습니다.");
    return;
  }

  const splittedText = [];
  const startLine = attachedDocumentSymbol[0].contentRange.start.line;
  if (startLine > 0) {
    const topEmptyRange = new vscode.Range(editor.document.lineAt(0).range.start, editor.document.lineAt(startLine - 1).range.end);
    splittedText.push(editor.document.getText(topEmptyRange));
  }

  const sortedDocumentSymbol = sortTreeSymbols(attachedDocumentSymbol, isSortingChildren, isAscending);
  
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
    finalSelectedSymbolNext
      ? editor.document.lineAt(finalSelectedSymbolNext.range.start.line - 1).range.end
      : editor.document.positionAt(editor.document.getText().length), // 문서 끝
  );

  editor.edit((editBuilder) => {
    editBuilder.replace(entireRange, splittedText.join("\n"));
  });

  vscode.window.showInformationMessage("성공적으로 정렬되었습니다!");
}