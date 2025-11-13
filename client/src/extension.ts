/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { EXTENSION_NAME, getConfig } from "./config";
import { LinkDefinitionProvider } from "./linkdef";
import { MarkPreview, getWebviewOptions } from './preview';
const parser = require("../media/parser/core/parser.js")

let client: LanguageClient;
let activeRules: vscode.Disposable[] = [];
enum Level {
  UP,
  DOWN,
}

export async function activate(context: ExtensionContext) {
  provideLink(context);
  
  vscode.commands.registerCommand("namucode.linkify", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("[[", "]]")) return;
    wrapByChar("[[", "]]");
  });

  vscode.commands.registerCommand("namucode.textBold", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("'''", "'''")) return;
    wrapByChar("'''", "'''");
  });

  vscode.commands.registerCommand("namucode.textItalic", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }
    if (tryUnwrapChar("''", "''")) return;
    wrapByChar("''", "''");
  });

  vscode.commands.registerCommand("namucode.textUnderline", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("__", "__")) return;
    wrapByChar("__", "__");
  });

  vscode.commands.registerCommand("namucode.textSuperscript", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("^^", "^^")) return;
    tryUnwrapChar(",,", ",,");
    wrapByChar("^^", "^^");
  });

  vscode.commands.registerCommand("namucode.textSubscript", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar(",,", ",,")) return;
    tryUnwrapChar("^^", "^^");
    wrapByChar(",,", ",,");
  });

  vscode.commands.registerCommand("namucode.textStrike", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("~~", "~~")) return;
    if (tryUnwrapChar("--", "--")) return;
    wrapByChar("~~", "~~");
  });

  vscode.commands.registerCommand("namucode.newParagraph", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    if (tryUnwrapChar("== ", " ==")) return;
    wrapByChar("== ", " ==");
  });

  vscode.commands.registerCommand("namucode.gotoLine", (line: number) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    vscode.commands.executeCommand("revealLine", {
      lineNumber: line,
      at: "top",
    });
  });

  vscode.commands.registerCommand("namucode.paragraphLevelDown", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    paragraphLeveling(Level.DOWN);
  });

  vscode.commands.registerCommand("namucode.paragraphLevelUp", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    paragraphLeveling(Level.UP);
  });

  vscode.commands.registerCommand("namucode.openSettings", () => {
    vscode.commands.executeCommand('workbench.action.openSettings', "@ext:jhk1090.namucode");
  });

  vscode.commands.registerCommand("namucode.openPreviewGuideline", () => {
    vscode.env.openExternal(vscode.Uri.parse("https://github.com/jhk1090/namucode/blob/main/docs/preview.md"));
  });

  vscode.commands.registerCommand("namucode.openIncludeParameterEditorGuideline", () => {
    vscode.env.openExternal(vscode.Uri.parse("https://github.com/jhk1090/namucode/blob/main/docs/preview.md#틀-매개변수-편집기"));
  });

  const preview = vscode.commands.registerCommand("namucode.preview", async ({ retry = false, editorComment = false }) => {
    const editor = vscode.window.activeTextEditor;

    if (retry) {
      if (!MarkPreview.currentActivePanelId) {
        vscode.window.showWarningMessage('현재 열려있는 미리보기 탭이 없습니다.');
        return;
      }
      MarkPreview.createOrShow({ context, panelId: MarkPreview.currentActivePanelId, isRenderRetry: retry, isEditorComment: editorComment });
      return;
    }

    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    MarkPreview.createOrShow({ context, extensionUri: context.extensionUri, panelId: "namucode-webview-" + filePath });
  });

  if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    for (const filePath of Object.keys(MarkPreview.currentPanels || {})) {
      vscode.window.registerWebviewPanelSerializer(filePath, {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
          console.log(`Got state: ${state}`);
          // Reset the webview options so we use latest uri for `localResourceRoots`.
          webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
          MarkPreview.revive(webviewPanel, context, context.extensionUri, "namucode-webview-" + filePath);
        },
      });
    }
  }

  const getIncludeParameterEditorHtml = () => {
    return `
          <html>
            <head>
            <style>
            body {
              padding: 0 var(--container-paddding);
              color: var(--vscode-foreground);
              font-size: var(--vscode-font-size);
              font-weight: var(--vscode-font-weight);
              font-family: var(--vscode-font-family);
              background-color: var(--vscode-editor-background);
            }
              
            code {
              font-size: var(--vscode-editor-font-size);
              font-family: var(--vscode-editor-font-family);
            }

            button {
              border: none;
              padding: var(--input-padding-vertical) var(--input-padding-horizontal);
              width: 100%;
              text-align: center;
              outline: 1px solid transparent;
              outline-offset: 2px !important;
              color: var(--vscode-button-foreground);
              background: var(--vscode-button-background);
            }

            button:hover {
              cursor: pointer;
              background: var(--vscode-button-hoverBackground);
            }

            button:focus {
              outline-color: var(--vscode-focusBorder);
            }

            textarea {
              display: block;
              width: 100%;
              border: 1px solid transparent;
              font-family: var(--vscode-font-family);
              padding: var(--input-padding-vertical) var(--input-padding-horizontal);
              color: var(--vscode-input-foreground);
              outline-color: var(--vscode-input-border);
              background-color: var(--vscode-input-background);
              resize: none;
              overflow: hidden;
              min-height: 50px;
            }
            </style>
            </head>
            <body style="padding:10px; padding-bottom: 40px;">
              <h3>매개변수 편집기</h3>
              <p>미리보기에 적용될 매개변수를 지정해보세요! <code>매개변수=값</code> 꼴로 지정할 수 있으며, 쉼표로 구분해 여러 매개변수를 넣을 수 있습니다. <code>\\,</code> 또는 <code>\\=</code>와 같은 이스케이프 문자도 적용 가능합니다.</p>
              <p>적용 시 현재 열려있는 미리보기와 앞으로 열리는 미리보기 모두를 대상으로 적용됩니다. 단, 이 기능을 사용하면 중첩 include문 방지로 인해 include 문법을 사용할 수 없습니다.</p>
              <p id="error" style="display: none; color: red;">매개변수 형식이 잘못되었습니다. 도움말이 필요하다면 <a href="https://github.com/jhk1090/namucode/blob/main/docs/preview.md#q-틀-매개변수-편집기-사용-중-매개변수-형식이-잘못되었습니다라고-뜹니다">여기</a>를 참고하세요.</p>
              <textarea id="input" style="width: 100%"></textarea>
              <div style="width: calc(100% - 20px); position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: row; gap: 5px;">
                <button id="apply" style="width: 100%; padding: 5px;">적용</button>
                <button id="reset" style="width: 100%; padding: 5px;">초기화</button>
              </div>
              <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('input');
                const button = document.getElementById("apply");
                const reset = document.getElementById("reset");
                const error = document.getElementById("error");

                const isValid = (content) => {
                  const fullRe = /^(?:(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)(?:,(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)*$/;
                  return fullRe.test(content)
                }

                const parseParams = (content) => {
                    content = content.replaceAll("\\n", "")
                    content = content.replaceAll("\\t", "")

                    // 전체 형식 검증 (선택적)
                    const fullRe = /^(?:(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)(?:,(?:\\\\.|[^=,\\\\])+=(?:\\\\.|[^,\\\\])*)*$/;
                    if (!fullRe.test(content)) {
                        throw new Error("Invalid format");
                    }

                    const pairRe = /((?:\\\\.|[^=,\\\\])+)=((?:\\\\.|[^,\\\\])*)/g;
                    const unescape = s => s.replace(/\\\\(.)/g, "$1");

                    const result = {};
                    let m;
                    while ((m = pairRe.exec(content)) !== null) {
                        const rawKey = m[1];
                        const rawVal = m[2];
                        const key = unescape(rawKey).trim();
                        const val = unescape(rawVal).trim();
                        result[key] = val;
                    }
                    return result;
                }

                // 이전 상태 복원
                const state = vscode.getState();
                if (state?.text) textarea.value = state.text;

                function autoResize() {
                  textarea.style.height = 'auto';         // 높이 초기화
                  textarea.style.height = textarea.scrollHeight + 'px'; // scrollHeight만큼 늘리기
                }

                // 입력값이 바뀔 때마다 저장
                textarea.addEventListener('input', () => {
                  if (isValid(textarea.value)) {
                    error.style.display = "none";
                    textarea.style.borderColor = "transparent";
                  } else {
                    error.style.display = "block";
                    textarea.style.borderColor = "red";
                  }

                  vscode.setState({ text: textarea.value });
                  autoResize();
                });

                button.addEventListener("click", () => {
                  try {
                    const data = textarea.value.trim() === "" ? "{}" : JSON.stringify(parseParams(textarea.value))
                    error.style.display = "none";
                    textarea.style.borderColor = "transparent";

                    vscode.postMessage({ type: 'update', data });
                  } catch (e) {
                    error.style.display = "block";
                    textarea.style.borderColor = "red";
                  }
                })

                reset.addEventListener("click", () => {
                  textarea.value = "";
                  vscode.setState({ text: textarea.value });
                  button.click();
                })

                window.addEventListener("message", (event) => {
                  const message = event.data;
                  textarea.value = message;
                  vscode.setState({ text: textarea.value });
                })

                autoResize();
              </script>
            </body>
          </html>
        `;
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("includeParameterEditor", {
      resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = getIncludeParameterEditorHtml();
        webviewView.webview.onDidReceiveMessage(msg => {
          if (msg.type === 'update') {
            const data = JSON.parse(msg.data)
            context.workspaceState.update('includeParameterEditorInput', Object.keys(data).length === 0 ? null : data);
            vscode.commands.executeCommand("namucode.retryPreview")
          }
        })
        // 초기 설정
        const editorInput = context.workspaceState.get("includeParameterEditorInput") as { [key: string]: string } | null;
        webviewView.webview.postMessage(editorInput ? Object.entries(editorInput).map(([key, value]) => `${key}=${value}`).join(", ") : "")
      },
    })
  );

  vscode.commands.registerCommand("namucode.openIncludeParameterEditor", async () => {
    vscode.commands.executeCommand('includeParameterEditor.focus');
  });

  const retryPreview = vscode.commands.registerCommand("namucode.retryPreview", () => {
    vscode.commands.executeCommand('namucode.preview', { retry: true });
  });

  const previewEditorComment = vscode.commands.registerCommand("namucode.previewEditorComment", () => {
    vscode.commands.executeCommand('namucode.preview', { retry: true, editorComment: true });
  });

  const sort = vscode.commands.registerCommand("namucode.paragraphSort", async () => { await sortParagraph(context) });

  context.subscriptions.push(preview, retryPreview, previewEditorComment, sort);

  const symbolProvider = new DocumentSymbolProvider(context);
  vscode.languages.registerDocumentSymbolProvider("namu", symbolProvider);

  vscode.languages.registerFoldingRangeProvider(
    "namu",
    new FoldingRangeProvider(context)
  );

  // Code to connect to sever
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "namu" },
      { scheme: "untitled", language: "namu" },
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };
  client = new LanguageClient("Namucode", serverOptions, clientOptions);
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

// Code to provide tableofcontents(outline)
class TreeSymbol extends vscode.DocumentSymbol {
  depth: number;
  children: TreeSymbol[];

  constructor(name: string, detail: string, kind: vscode.SymbolKind, range: vscode.Range, selectionRange: vscode.Range, depth: number) {
    super(name, detail, kind, range, selectionRange);
    this.depth = depth;
  }
}

class ParagraphTreeSymbol extends TreeSymbol {
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
  pureText: { type: "text", text: string; }[];
  actualLevel: number;
}

export class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  static cache = new Map<string, { version: number; config: { editorComment: boolean; maxParsingDepth: number; }; promise: Promise<any>; isMaxCharacterAlerted: boolean; }>();
  private context: vscode.ExtensionContext
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  public async provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<TreeSymbol[]> {
    const rootConfig = vscode.workspace.getConfiguration("namucode");
    const maxParsingDepth = rootConfig.get<number>("parser.maxParsingDepth", 30);
    const maxCharacter = rootConfig.get<number>("parser.maxParsingCharacter", 1500000);

    const config = { editorComment: false, maxParsingDepth, maxCharacter }
    const promise = this.createParserPromise(document, config);

    const result = await promise;

    const key = document.uri.toString();
    const cached = DocumentSymbolProvider.cache.get(key);

    if (result.errorCode && !cached.isMaxCharacterAlerted) {
      const msg = await vscode.window.showWarningMessage(`파싱 허용 문서 최대 글자 수인 ${maxCharacter}자가 넘어가 목차 표시/문단 접기/미리보기 기능을 사용할 수 없습니다. 글자 수를 줄이거나 설정에서 "파싱 허용 문서 최대 글자 수"를 늘릴 수 있습니다.`, "설정")
      if (msg === "설정") {
        vscode.commands.executeCommand('workbench.action.openSettings', "@ext:jhk1090.namucode");
      }
      DocumentSymbolProvider.cache.set(key, { ...cached, isMaxCharacterAlerted: true });
      return []
    }

    return this.createSymbol(document, result);
  }

  public async createParserPromise(document: vscode.TextDocument, { editorComment = false, maxParsingDepth = null, maxCharacter = 1500000 }): Promise<any> {
    const key = document.uri.toString();
    const version = document.version;

    const cached = DocumentSymbolProvider.cache.get(key);

    if (document.getText().length > maxCharacter) {
      return { errorCode: "max_character" }
    } else {
      DocumentSymbolProvider.cache.set(key, { ...cached, isMaxCharacterAlerted: false });
    }

    if (cached && cached.version === version && cached.config.editorComment === editorComment && cached.config.maxParsingDepth === maxParsingDepth) {
      console.log("[Parser] ♻️ Promise 재활용: ", decodeURIComponent(path.basename(key)));
      return cached.promise;
    }
    
    const promise = new Promise(async (resolve, reject) => {
      const text = document.getText();
      let parseStart = performance.now()
      const result = parser(text, { editorComment, maxParsingDepth });
      let parseEnd = performance.now()
      console.log("[Parser] 📌 파싱 중...", decodeURIComponent(path.basename(document.uri.toString())), "v", document.version, "(time: ", (parseEnd - parseStart).toFixed(2), "ms)")

      resolve(result)
    })

    console.log("[Parser] ⚙️ Promise 생성: ", decodeURIComponent(path.basename(key)), "v", version);

    DocumentSymbolProvider.cache.set(key, { ...cached, version, promise, config: { editorComment, maxParsingDepth } });
    return promise;
  }

  private createSymbol(document: vscode.TextDocument, result: any) {
      const symbols: TreeSymbol[] = [];
      let curHeadings: [IHeading, TreeSymbol][] = [];

      const headings: IHeading[] = result.data.headings
      const makeTreeSymbol = (heading: IHeading) => {
        return new TreeSymbol(heading.numText + ". " + heading.pureText.map(v => v.text).join(""), "", vscode.SymbolKind.String, document.lineAt(heading.line - 1).range, document.lineAt(heading.line - 1).range, heading.actualLevel)
      }
      for (const heading of headings) {
        // 초기 상태
        if (curHeadings.length == 0) {
          curHeadings.push([heading, makeTreeSymbol(heading)])
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
                curHeadings[index - 1][1].children.push(targetHeadings[i][1])  
                break;
              }
              // 모두 삽입 시 상위 문단 없음 (최고 문단)
              if (i == 0 && index == 0) {
                symbols.push(targetHeadings[i][1])  
                break;
              }

              targetHeadings[i - 1][1].children.push(targetHeadings[i][1])
            }

            // 하위 문단 제거
            curHeadings.splice(index, targetHeadings.length);
            
            break;
          }
        }

        curHeadings.push([heading, makeTreeSymbol(heading)])
      }

      // 후처리
      for (let i = curHeadings.length - 1; i >= 0; i--) {
        if (i == 0) {
          symbols.push(curHeadings[i][1])  
          break;
        }

        curHeadings[i - 1][1].children.push(curHeadings[i][1])
      }

      // console.log(headings, curHeadings, symbols)
      return symbols
  }
}

function flattenSymbols(symbols: TreeSymbol[]): TreeSymbol[] {
  const result: TreeSymbol[] = [];

  for (const sym of symbols) {
    result.push(sym);
    if (sym.children?.length) {
      result.push(...flattenSymbols(sym.children));
    }
  }

  return result;
}

class FoldingRangeProvider implements vscode.FoldingRangeProvider {
  constructor(private context: ExtensionContext) {}

  async provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): Promise<vscode.FoldingRange[]> {
    console.log("folding", decodeURIComponent(path.basename(document.uri.path)))

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
      ranges.push(new vscode.FoldingRange(start, end))
    }

    return ranges;
  }
}

// FIXME: Code to sort paragraph
const sortParagraph = async (context: vscode.ExtensionContext) => {
  const editor = vscode.window.activeTextEditor;
  const symbolProvider = new DocumentSymbolProvider(context);

  const cts = new vscode.CancellationTokenSource();
  const symbolsProvided = await symbolProvider.provideDocumentSymbols(vscode.window.activeTextEditor.document, cts.token);
  let symbols!: ParagraphTreeSymbol[];
  let isDocumentPerfect = true;
  let imperfectReason = "";

  if (!editor || editor.document.languageId !== 'namu') {
    vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
    return;
  }

  const sanitizeName = (name: string) => name.split(". ").slice(1).join(". ")

  const modifySymbolTree = (tree: TreeSymbol[], lastLine: vscode.TextLine) => {
    const symbols: ParagraphTreeSymbol[] = [];

    for (let i = 0; i < tree.length; i++) {
      const current = tree[i];
      const next = tree?.[i + 1];

      let symbolToPush!: ParagraphTreeSymbol;
      if (next) {
        symbolToPush = new ParagraphTreeSymbol(
          current,
          new vscode.Range(current.range.start, editor.document.lineAt(next.range.start.line - 1).range.end)
        );
        symbolToPush.children = modifySymbolTree(current.children, editor.document.lineAt(next.range.start.line - 1));
      } else {
        symbolToPush = new ParagraphTreeSymbol(current, new vscode.Range(current.range.start, lastLine.range.end));
        symbolToPush.children = modifySymbolTree(current.children, lastLine);
      }

      symbols.push(symbolToPush);
    }

    if (imperfectReason === "") {
      const symbolsLevel = symbols.map(v => v.depth)
      const top: number = symbolsLevel[0];
      let prev = top;
      for (let index = 0; index < symbolsLevel.length; index++) {
        const level = symbolsLevel[index];
        if (prev > level) {
          if (level !== top) {
            const disqualified = symbols[index - 1]
            const compared = symbols[index]

            imperfectReason = `${disqualified.depth}단계 문단 "${disqualified.name}"은 ${compared.depth}단계 문단 "${compared.name}"보다 선행될 수 없습니다.`
            isDocumentPerfect = false;
            break;
          }
        }
  
        prev = level;
      }
    }

    return symbols;
  };

  symbols = modifySymbolTree(symbolsProvided, editor.document.lineAt(editor.document.lineCount - 1));
  if (symbols.length == 0) {
    vscode.window.showErrorMessage(`문서 내에 문단이 없습니다.`);
    return;
  }

  if (!isDocumentPerfect) {
    vscode.window.showErrorMessage(`문단 구성이 완벽하지 않습니다. ${imperfectReason}`);
    return;
  }

  let indexed!: string[];
  const indexTree = (tree: ParagraphTreeSymbol[]) => {
    let indexed: string[] = [];

    const indexMapList = tree
      .map((v, i) => {
        return [sanitizeName(v.name), i];
      })
      .sort((first, second) => {
        if (first[0] < second[0]) return -1;
        if (first[0] > second[0]) return 1;
        return 0;
      }) as [string, number][];
    for (const indexMap of indexMapList) {
      const value = tree[indexMap[1]];
      if (value.children.length !== 0) {
        const childrenIndexed = indexTree(value.children);
        const childrenRangeStart = value.children[0].contentRange.start;
        const noChildrenContentRange = new vscode.Range(value.contentRange.start, editor.document.lineAt(childrenRangeStart.line - 1).range.end);
        // console.log([editor.document.getText(noChildrenContentRange)]);
        indexed.push(...[editor.document.getText(noChildrenContentRange).replaceAll("\r", ""), ...childrenIndexed]);
      } else {
        indexed.push(editor.document.getText(value.contentRange).replaceAll("\r", ""));
      }
    }

    return indexed;
  };

  indexed = indexTree(symbols);

  const nonBodyRangeEnd = symbols[0].range.start.line - 1
  if (nonBodyRangeEnd > -1) {
    indexed = [
      editor.document.getText(new vscode.Range(editor.document.positionAt(0), editor.document.lineAt(nonBodyRangeEnd).range.end)),
      ...indexed,
    ];
  }

  // 문서의 전체 범위를 가져옵니다.
  const entireRange = new vscode.Range(
    editor.document.positionAt(0), // 문서 시작
    editor.document.positionAt(editor.document.getText().length) // 문서 끝
  );

  editor.edit((editBuilder) => {
    editBuilder.replace(entireRange, indexed.join("\n"));
  });

  vscode.window.showInformationMessage("성공적으로 정렬되었습니다!");
};

// Code to provide shortcuts

const paragraphLeveling = (type: Level) => {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const document = editor.document;
    const lineRange = getSelectedLineRange();

    let lines = document.getText(lineRange).split("\n");
    if (type == Level.UP) {
      const paragraphRegex = /(^(={1,5})(#?) (.*) (\2)(\1)(?<returnChar>\r)?$)/;
      for (let i = 0; i < lines.length; i++) {
        const execResult = paragraphRegex.exec(lines[i]);
        // console.log(execResult);
        if (execResult !== null) {
          if (execResult.groups?.returnChar === "\r") {
            lines[i] = lines[i].replace("\r", "");
            lines[i] = `=${lines[i]}=\r`;
          } else {
            lines[i] = `=${lines[i]}=`;
          }
        }
        paragraphRegex.lastIndex = 0;
      }
    } else if (type == Level.DOWN) {
      const paragraphRegex = /(^(={2,6})(#?) (.*) (\2)(\1)(?<returnChar>\r)?$)/;
      for (let i = 0; i < lines.length; i++) {
        const execResult = paragraphRegex.exec(lines[i]);
        if (execResult !== null) {
          if (execResult.groups?.returnChar === "\r") {
            lines[i] = lines[i].replace("\r", "");
            lines[i] = `${lines[i].slice(1, -1)}\r`;
          } else {
            lines[i] = lines[i].slice(1, -1);
          }
        }
        paragraphRegex.lastIndex = 0;
      }
    }

    editor.edit((editBuilder) => {
      editBuilder.replace(lineRange, lines.join("\n"));
    });
  }
};

const wrapByChar = (prefix, postfix) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const selection = editor.selection;
  const word = document.getText(selection);

  // 굵게, 기울임 구분용 공백 삽입
  if (word.match(/^'/) && (prefix == "''" || prefix == "'''")) prefix = `${prefix} `;
  if (word.match(/'$/) && (postfix == "''" || postfix == "'''")) postfix = ` ${postfix}`;

  editor.edit((editBuilder) => {
    editBuilder.replace(selection, `${prefix}${word}${postfix}`);
  });
};

const tryUnwrapChar = (prefix, postfix) => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;

  const document = editor.document;
  const selection = editor.selection;
  const word = document.getText(selection);
  const re = new RegExp(`^ *${escapeRegex(prefix)}([^'].*?[^'])${escapeRegex(postfix)} *$`);
  const matched = word.match(re);

  if (matched) {
    editor.edit((editBuilder) => {
      editBuilder.replace(selection, matched[1]);
    });
    return true;
  }
};

// Code to provide URL

const provideLink = (context: vscode.ExtensionContext): void => {
  const config = getConfig();

  for (const rule of activeRules) {
    rule.dispose();
  }

  activeRules = config.rules.map((rule) => {
    return vscode.languages.registerDocumentLinkProvider(
      rule.languages.map((language) => ({ language })),
      new LinkDefinitionProvider(rule.linkPattern, rule.linkPatternFlags, rule.linkTarget)
    );
  });

  for (const rule of activeRules) {
    context.subscriptions.push(rule);
  }
};

// Code of module function

const escapeRegex = (string) => string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");

const getSelectedLineRange = (): vscode.Range | null => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return null;
  }

  const selection = editor.selection;
  const startLine = selection.start.line;
  const endLine = selection.end.line;

  const start = new vscode.Position(startLine, 0);
  const end = new vscode.Position(endLine, editor.document.lineAt(endLine).text.length);

  return new vscode.Range(start, end);
};