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
import { NamuMark } from "namumark-clone-core";
import * as cheerio from "cheerio";
import { MarkPreview, getWebviewOptions } from './preview';

let client: LanguageClient;
let activeRules: vscode.Disposable[] = [];
enum Level {
  UP,
  DOWN,
}

export function activate(context: ExtensionContext) {
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

  const preview = vscode.commands.registerCommand("namucode.preview", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'namu') {
      vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    MarkPreview.createOrShow(context, context.extensionUri, filePath);
  });

  if (vscode.window.registerWebviewPanelSerializer) {
    // Make sure we register a serializer in activation event
    for (const filePath of Object.keys(MarkPreview.currentPanels || {})) {
      vscode.window.registerWebviewPanelSerializer(filePath, {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
          console.log(`Got state: ${state}`);
          // Reset the webview options so we use latest uri for `localResourceRoots`.
          webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
          MarkPreview.revive(webviewPanel, context, context.extensionUri, filePath);
        },
      });
    }
  }

  const sort = vscode.commands.registerCommand("namucode.paragraphSort", sortParagraph);

  context.subscriptions.push(preview, sort);

  const symbolProvider = new DocumentSymbolProvider();
  vscode.languages.registerDocumentSymbolProvider("namu", symbolProvider);

  //FIXME: vscode.languages.registerFoldingRangeProvider(
  //   "namu",
  //   new FoldingRangeProvider(symbolProvider)
  // );

  // Code to connect to sever
  const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));

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

class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(document: vscode.TextDocument): Thenable<TreeSymbol[]> {
    return new Promise((resolve, reject) => {
      let symbols: TreeSymbol[] = [];
      let parents: TreeSymbol[] = [];

      for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        const match = line.text.match(/^(={1,6})(#?) (.*) (\2)(\1)$/);

        if (match) {
          const depth = match[1].length;
          let name!: string;
          try {
            const result = new NamuMark(match[3], { docName: "" }, { data: [] }).parse()[0];
            const $ = cheerio.load(`<main>${result}</main>`);
            name = $.text();
          } catch (err) {
            console.error(err);
            name = match[3];
          }
          const symbol = new TreeSymbol(name, "", vscode.SymbolKind.TypeParameter, line.range, line.range, depth);
          if (depth === 1) {
            symbols.push(symbol);
            parents = [symbol];
          } else {
            while (parents.length > 0 && parents[parents.length - 1].depth >= depth) {
              parents.pop();
            }
            if (parents.length > 0) {
              let parent = parents[parents.length - 1];
              parent.children.push(symbol);
            } else {
              symbols.push(symbol);
            }
            parents.push(symbol);
          }
        }
      }
      resolve(symbols);
    });
  }
}

//TODO: Code to provide fold
/*
class FoldingRangeProvider implements vscode.FoldingRangeProvider {
  constructor(private symbolProvider: DocumentSymbolProvider) {}

  provideFoldingRanges(
    document: vscode.TextDocument,
    context: vscode.FoldingContext,
    token: vscode.CancellationToken
  ): Thenable<vscode.FoldingRange[]> {
    return this.symbolProvider
      .provideDocumentSymbols(document)
      .then((symbols) => {
        console.log("ES");
        let ranges: vscode.FoldingRange[] = [];

        const addFoldingRanges = (symbol: vscode.DocumentSymbol) => {
          const start = symbol.range.start.line;
          const end = symbol.children[symbol.children.length - 1].range.end.line;
          ranges.push(new vscode.FoldingRange(start, end));
          symbol.children.forEach(addFoldingRanges);
        };

        symbols.forEach((symbol) => {
          addFoldingRanges(symbol);
          console.log(ranges);
        });
        return ranges;
      });
  }
}
*/
// FIXME: Code to sort paragraph
const sortParagraph = async () => {
  const editor = vscode.window.activeTextEditor;
  const symbolProvider = new DocumentSymbolProvider();
  const symbolsProvided = await symbolProvider.provideDocumentSymbols(vscode.window.activeTextEditor.document);
  let symbols!: ParagraphTreeSymbol[];
  let isDocumentPerfect = true;
  let imperfectReason = "";

  if (!editor || editor.document.languageId !== 'namu') {
    vscode.window.showWarningMessage('이 명령어는 나무마크 파일(*.namu)에서만 사용할 수 있습니다.');
    return;
  }

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

  console.log(symbols);
  console.log(isDocumentPerfect);

  if (!isDocumentPerfect) {
    vscode.window.showErrorMessage(`문단 구성이 완벽하지 않습니다. ${imperfectReason}`);
    return;
  }

  let indexed!: string[];
  const indexTree = (tree: ParagraphTreeSymbol[]) => {
    let indexed: string[] = [];

    const indexMapList = tree
      .map((v, i) => {
        return [v.name, i];
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
        console.log([editor.document.getText(noChildrenContentRange)]);
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
        console.log(execResult);
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