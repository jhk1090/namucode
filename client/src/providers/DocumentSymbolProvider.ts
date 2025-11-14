import * as vscode from "vscode";
const parser = require("../../media/parser/core/parser.js");

// Code to provide tableofcontents(outline)
export class TreeSymbol extends vscode.DocumentSymbol {
  depth: number;
  children: TreeSymbol[];

  constructor(name: string, detail: string, kind: vscode.SymbolKind, range: vscode.Range, selectionRange: vscode.Range, depth: number) {
    super(name, detail, kind, range, selectionRange);
    this.depth = depth;
  }
}
export class ParagraphTreeSymbol extends TreeSymbol {
  contentRange: vscode.Range;
  children: ParagraphTreeSymbol[];

  constructor(symbol: TreeSymbol, contentRange: vscode.Range) {
    super(symbol.name, symbol.detail, symbol.kind, symbol.range, symbol.selectionRange, symbol.depth);
    this.contentRange = contentRange;
  }
}
interface IHeading {
  line: number;
  level: number;
  closed: boolean;
  sectionNum: number;
  numText: string;
  pureText: { type: "text"; text: string; }[];
  actualLevel: number;
}

export class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  static cache = new Map<string, { version: number; config: { editorComment: boolean; maxParsingDepth: number; }; promise: Promise<any>; isMaxCharacterAlerted: boolean; }>();
  private context: vscode.ExtensionContext;
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<TreeSymbol[]> {
    const rootConfig = vscode.workspace.getConfiguration("namucode");
    const maxParsingDepth = rootConfig.get<number>("parser.maxParsingDepth", 30);
    const maxCharacter = rootConfig.get<number>("parser.maxParsingCharacter", 1500000);

    const config = { editorComment: false, maxParsingDepth, maxCharacter };
    const promise = DocumentSymbolProvider.createParserPromise(document, config);

    const result = await promise;

    const key = document.uri.toString();
    const cached = DocumentSymbolProvider.cache.get(key);

    if (result.errorCode && !cached.isMaxCharacterAlerted) {
      const msg = await vscode.window.showWarningMessage(`파싱 허용 문서 최대 글자 수인 ${maxCharacter}자가 넘어가 목차 표시/문단 접기/미리보기 기능을 사용할 수 없습니다. 글자 수를 줄이거나 설정에서 "파싱 허용 문서 최대 글자 수"를 늘릴 수 있습니다.`, "설정");
      if (msg === "설정") {
        vscode.commands.executeCommand('workbench.action.openSettings', "@ext:jhk1090.namucode");
      }
      DocumentSymbolProvider.cache.set(key, { ...cached, isMaxCharacterAlerted: true });
      return [];
    }

    return this.createSymbol(document, result);
  }

  static async createParserPromise(document: vscode.TextDocument, { editorComment = false, maxParsingDepth = null, maxCharacter = 1500000 }): Promise<any> {
    const key = document.uri.toString();
    const version = document.version;

    const cached = DocumentSymbolProvider.cache.get(key);

    if (document.getText().length > maxCharacter) {
      return { errorCode: "max_character" };
    } else {
      DocumentSymbolProvider.cache.set(key, { ...cached, isMaxCharacterAlerted: false });
    }

    if (cached && cached.version === version && cached.config.editorComment === editorComment && cached.config.maxParsingDepth === maxParsingDepth) {
      // console.log("[Parser] ♻️ Promise 재활용: ");
      return cached.promise;
    }

    const promise = new Promise(async (resolve, reject) => {
      const text = document.getText();
      // let parseStart = performance.now();
      const result = parser(text, { editorComment, maxParsingDepth });
      // let parseEnd = performance.now();
      // console.log("[Parser] 📌 파싱 중...", "v", document.version, "(time: ", (parseEnd - parseStart).toFixed(2), "ms)")
      resolve(result);
    });

    // console.log("[Parser] ⚙️ Promise 생성: ", "v", version);
    DocumentSymbolProvider.cache.set(key, { ...cached, version, promise, config: { editorComment, maxParsingDepth } });
    return promise;
  }

  private createSymbol(document: vscode.TextDocument, result: any) {
    const symbols: TreeSymbol[] = [];
    let curHeadings: [IHeading, TreeSymbol][] = [];

    const headings: IHeading[] = result.data.headings;
    const makeTreeSymbol = (heading: IHeading) => {
      return new TreeSymbol(heading.numText + ". " + heading.pureText.map(v => v.text).join(""), "", vscode.SymbolKind.String, document.lineAt(heading.line - 1).range, document.lineAt(heading.line - 1).range, heading.actualLevel);
    };
    for (const heading of headings) {
      // 초기 상태
      if (curHeadings.length == 0) {
        curHeadings.push([heading, makeTreeSymbol(heading)]);
        continue;
      }

      // loop
      for (const [index, [curHeading, curSymbol]] of curHeadings.entries()) {
        // 상위 또는 같은 문단 => 삭제 및 추가
        if (heading.actualLevel <= curHeading.actualLevel) {

          // 하위 문단 모두 재귀적으로 상위 문단 삽입
          let targetHeadings = curHeadings.slice(index);
          for (let i = targetHeadings.length - 1; i >= 0; i--) {
            // 모두 삽입 시 상위 문단 남아있음
            if (i == 0 && index != 0) {
              curHeadings[index - 1][1].children.push(targetHeadings[i][1]);
              break;
            }
            // 모두 삽입 시 상위 문단 없음 (최고 문단)
            if (i == 0 && index == 0) {
              symbols.push(targetHeadings[i][1]);
              break;
            }

            targetHeadings[i - 1][1].children.push(targetHeadings[i][1]);
          }

          // 하위 문단 제거
          curHeadings.splice(index, targetHeadings.length);

          break;
        }
      }

      curHeadings.push([heading, makeTreeSymbol(heading)]);
    }

    // 후처리
    for (let i = curHeadings.length - 1; i >= 0; i--) {
      if (i == 0) {
        symbols.push(curHeadings[i][1]);
        break;
      }

      curHeadings[i - 1][1].children.push(curHeadings[i][1]);
    }

    // console.log(headings, curHeadings, symbols)
    return symbols;
  }
}
