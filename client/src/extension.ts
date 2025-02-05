/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { EXTENSION_NAME, getConfig } from "./config";
import { LinkDefinitionProvider } from "./linkdef";
import { NamuMark } from 'namumark-clone-core';
import * as cheerio from "cheerio";

var isDocumentPerfect = true;
let client: LanguageClient;
let activeRules: vscode.Disposable[] = [];
enum Level {
  UP,
  DOWN,
}

export function activate(context: ExtensionContext) {
  modifyParagraph(context);
  provideLink(context);

  vscode.commands.registerCommand("namucode.linkify", () => {
    if (tryUnwrapChar("[[", "]]")) return;
    wrapByChar("[[", "]]");
  });

  vscode.commands.registerCommand("namucode.textBold", () => {
    if (tryUnwrapChar("'''", "'''")) return;
    wrapByChar("'''", "'''");
  });

  vscode.commands.registerCommand("namucode.textItalic", () => {
    if (tryUnwrapChar("''", "''")) return;
    wrapByChar("''", "''");
  });

  vscode.commands.registerCommand("namucode.textUnderline", () => {
    if (tryUnwrapChar("__", "__")) return;
    wrapByChar("__", "__");
  });

  vscode.commands.registerCommand("namucode.textSuperscript", () => {
    if (tryUnwrapChar("^^", "^^")) return;
    tryUnwrapChar(",,", ",,");
    wrapByChar("^^", "^^");
  });

  vscode.commands.registerCommand("namucode.textSubscript", () => {
    if (tryUnwrapChar(",,", ",,")) return;
    tryUnwrapChar("^^", "^^");
    wrapByChar(",,", ",,");
  });

  vscode.commands.registerCommand("namucode.textStrike", () => {
    if (tryUnwrapChar("~~", "~~")) return;
    if (tryUnwrapChar("--", "--")) return;
    wrapByChar("~~", "~~");
  });

  vscode.commands.registerCommand("namucode.newParagraph", () => {
    if (tryUnwrapChar("== ", " ==")) return;
    wrapByChar("== ", " ==");
  });

  vscode.commands.registerCommand("namucode.gotoLine", (line: number) => {
    vscode.commands.executeCommand("revealLine", {
      lineNumber: line,
      at: "top",
    });
  });

  vscode.commands.registerCommand("namucode.preview", () => {
    MarkPreview.createOrShow(context, context.extensionUri);
  });

  if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(MarkPreview.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				MarkPreview.revive(webviewPanel, context, context.extensionUri);
			}
		});
	}

  const symbolProvider = new DocumentSymbolProvider();
  vscode.languages.registerDocumentSymbolProvider("namu", symbolProvider);

  //FIXME: vscode.languages.registerFoldingRangeProvider(
  //   "namu",
  //   new FoldingRangeProvider(symbolProvider)
  // );

  // Code to connect to sever
  const serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

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

  constructor(
    name: string,
    detail: string,
    kind: vscode.SymbolKind,
    range: vscode.Range,
    selectionRange: vscode.Range,
    depth: number
  ) {
    super(name, detail, kind, range, selectionRange);
    this.depth = depth;
  }
}
class DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument
  ): Thenable<vscode.DocumentSymbol[]> {
    return new Promise((resolve, reject) => {
      let symbols: vscode.DocumentSymbol[] = [];
      let parents: TreeSymbol[] = [];

      for (let i = 0; i < document.lineCount; i++) {
        let line = document.lineAt(i);
        const match = line.text.match(/^(={1,6})(#?) (.*) (\2)(\1)$/);

        if (match) {
          const depth = match[1].length;
          let name!: string;
          try {
            const result = new NamuMark(match[3], { docName: "" }, { data: [] }).parse()[0]
            const $ = cheerio.load(`<main>${result}</main>`)
            name = $.text()
          } catch (err) {
            console.error(err);
            name = match[3]
          }
          const symbol = new TreeSymbol(
            name,
            "",
            vscode.SymbolKind.TypeParameter,
            line.range,
            line.range,
            depth
          );
          if (depth === 1) {
            symbols.push(symbol);
            parents = [symbol];
          } else {
            while (
              parents.length > 0 &&
              parents[parents.length - 1].depth >= depth
            ) {
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
const modifyParagraph = (context: vscode.ExtensionContext) => {
  interface typeTreeStruct {
    title: string;
    range: number[];
    children: typeTreeStruct[];
  }

  var paragraph: typeTreeStruct[] = [];

  const treeStruct = (
    name: string,
    range1: string,
    range2: string,
    children?: []
  ) => {
    const length = Number(range2) - Number(range1);
    let child: typeTreeStruct[] = [];
    if (children != undefined) child = children;
    return {
      title: name,
      range: [...Array(length).keys()].map((e) => e + Number(range1)),
      children: child,
    };
  };

  const analyzeThree = (content: string) => {
    const titleRegexThree = /^#(.*)#=== (.*) ===$|^#(.*)#===# (.*) #===$/gm;
    let queue: { [k: string]: RegExpMatchArray[] } = {};
    const analysisThree = [...content.matchAll(titleRegexThree)];

    if (analysisThree.length == 0) return;

    analysisThree.forEach((element) => {
      let pindex = 0;
      for (const [k, v] of paragraph.entries()) {
        if (v.range.includes(Number(element[1]))) {
          pindex = k;
          break;
        }
      }
      if (queue[String(pindex)] == undefined) {
        queue[String(pindex)] = [];
      }

      queue[String(pindex)].push(element);
    });
    for (const [key, value] of Object.entries(queue)) {
      value.forEach((e, i) => {
        // 뒤에 3단계 문장 있음
        if (i < value.length - 1)
          paragraph[Number(key)].children.push(
            treeStruct(e[2], e[1], value[i + 1][1])
          );
        else if (Number(key) < paragraph.length - 1)
          // 뒤에 3단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
          paragraph[Number(key)].children.push(
            treeStruct(e[2], e[1], String(paragraph[Number(key) + 1].range[0]))
          );
        // 뒤에 2, 3단계 문장 없음 = 현재 2단계 문장의 끝 index 기준
        else
          paragraph[Number(key)].children.push(
            treeStruct(
              e[2],
              e[1],
              String(Number(paragraph[Number(key)].range.at(-1)) + 1)
            )
          );
      });
    }

    queue = {};
    analyzeFour(content);
    return;
  };

  const analyzeFour = (content: string) => {
    const titleRegexFour = /^#(.*)#==== (.*) ====$|^#(.*)#====# (.*) #====$/gm;
    let queue: { [k: string]: { [k: string]: RegExpMatchArray[] } } = {};
    const analysisFour = [...content.matchAll(titleRegexFour)];

    if (analysisFour.length == 0) return;

    analysisFour.forEach((element) => {
      let twoIndex = 0;
      let threeIndex = 0;
      for (const [k, v] of paragraph.entries()) {
        if (v.range.includes(Number(element[1]))) {
          twoIndex = k;
          for (const [kThree, vThree] of v.children.entries()) {
            if (vThree.range.includes(Number(element[1]))) {
              threeIndex = kThree;
              break;
            }
          }
          break;
        }
      }
      if (queue[String(twoIndex)] == undefined) queue[String(twoIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)] == undefined)
        queue[String(twoIndex)][String(threeIndex)] = [];

      queue[String(twoIndex)][String(threeIndex)].push(element);
    });
    for (const [keyTwo, valueTwo] of Object.entries(queue)) {
      for (const [keyThree, valueThree] of Object.entries(valueTwo)) {
        const k2 = Number(keyTwo);
        const k3 = Number(keyThree);
        let target = paragraph[k2].children[k3].children;
        valueThree.forEach((e, i) => {
          // 뒤에 4단계 문장 있음
          if (i < valueThree.length - 1) {
            target.push(treeStruct(e[2], e[1], valueThree[i + 1][1]));
            return;
          } else if (k3 < paragraph[k2].children.length - 1) {
            // 뒤에 4단계 문장 없음 = 다음 3단계 문장의 첫 index 기준 && 뒤에 3단계 문장 있음
            target.push(
              treeStruct(
                e[2],
                e[1],
                String(paragraph[k2].children[k3 + 1].range[0])
              )
            );
            return;
          } else if (k2 < paragraph.length - 1) {
            // 뒤에 3, 4단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
            target.push(
              treeStruct(e[2], e[1], String(Number(paragraph[k2 + 1].range[0])))
            );
            return;
          } else {
            // 뒤에 2, 3, 4단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
            target.push(
              treeStruct(
                e[2],
                e[1],
                String(Number(paragraph[k2].range.at(-1)) + 1)
              )
            );
            return;
          }
        });
      }
    }

    queue = {};
    analyzeFive(content);
    return;
  };

  const analyzeFive = (content: string) => {
    const titleRegexFive =
      /^#(.*)#===== (.*) =====$|^#(.*)#=====# (.*) #=====$/gm;
    let queue: {
      [k: string]: { [k: string]: { [k: string]: RegExpMatchArray[] } };
    } = {};
    const analysisFive = [...content.matchAll(titleRegexFive)];

    if (analysisFive.length == 0) return;

    analysisFive.forEach((element) => {
      let twoIndex = 0;
      let threeIndex = 0;
      let fourIndex = 0;
      for (const [k, v] of paragraph.entries()) {
        if (v.range.includes(Number(element[1]))) {
          twoIndex = k;
          for (const [kThree, vThree] of v.children.entries()) {
            if (vThree.range.includes(Number(element[1]))) {
              threeIndex = kThree;
              for (const [kFour, vFour] of vThree.children.entries()) {
                if (vFour.range.includes(Number(element[1]))) {
                  fourIndex = kFour;
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }
      if (queue[String(twoIndex)] == undefined) queue[String(twoIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)] == undefined)
        queue[String(twoIndex)][String(threeIndex)] = {};
      if (
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] ==
        undefined
      )
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] = [];

      queue[String(twoIndex)][String(threeIndex)][String(fourIndex)].push(
        element
      );
    });
    for (const [keyTwo, valueTwo] of Object.entries(queue)) {
      for (const [keyThree, valueThree] of Object.entries(valueTwo)) {
        for (const [keyFour, valueFour] of Object.entries(valueThree)) {
          const k2 = Number(keyTwo);
          const k3 = Number(keyThree);
          const k4 = Number(keyFour);
          let target = paragraph[k2].children[k3].children[k4].children;
          valueFour.forEach((e, i) => {
            // 뒤에 5단계 문장 있음
            if (i < valueFour.length - 1) {
              target.push(treeStruct(e[2], e[1], valueFour[i + 1][1]));
              return;
            }
            // 뒤에 5단계 문장 없음 = 다음 4단계 문장의 첫 index 기준 && 뒤에 4단계 문장 있음
            else if (k4 < paragraph[k2].children[k3].children.length - 1) {
              target.push(
                treeStruct(
                  e[2],
                  e[1],
                  String(paragraph[k2].children[k3].children[k4 + 1].range[0])
                )
              );
              return;
            } else if (k3 < paragraph[k2].children.length - 1) {
              // 뒤에 4, 5단계 문장 없음 = 다음 3단계 문장의 첫 index 기준 && 뒤에 3단계 문장 있음
              target.push(
                treeStruct(
                  e[2],
                  e[1],
                  String(paragraph[k2].children[k3 + 1].range[0])
                )
              );
              return;
            } else if (k2 < paragraph.length - 1) {
              // 뒤에 3, 4, 5단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
              target.push(
                treeStruct(
                  e[2],
                  e[1],
                  String(Number(paragraph[k2 + 1].range[0]))
                )
              );
              return;
            } else {
              // 뒤에 2, 3, 4, 5단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
              target.push(
                treeStruct(
                  e[2],
                  e[1],
                  String(Number(paragraph[k2].range.at(-1)) + 1)
                )
              );
              return;
            }
          });
        }
      }
    }

    queue = {};
    analyzeSix(content);
    return;
  };

  const analyzeSix = (content: string) => {
    const titleRegexSix =
      /^#(.*)#====== (.*) ======$|^#(.*)#======# (.*) #======$/gm;
    let queue: {
      [k: string]: {
        [k: string]: { [k: string]: { [k: string]: RegExpMatchArray[] } };
      };
    } = {};
    const analysisSix = [...content.matchAll(titleRegexSix)];

    if (analysisSix.length == 0) return;

    analysisSix.forEach((element) => {
      let twoIndex = 0;
      let threeIndex = 0;
      let fourIndex = 0;
      let fiveIndex = 0;
      for (const [k, v] of paragraph.entries()) {
        if (v.range.includes(Number(element[1]))) {
          twoIndex = k;
          for (const [kThree, vThree] of v.children.entries()) {
            if (vThree.range.includes(Number(element[1]))) {
              threeIndex = kThree;
              for (const [kFour, vFour] of vThree.children.entries()) {
                if (vFour.range.includes(Number(element[1]))) {
                  fourIndex = kFour;
                  for (const [kFive, vFive] of vFour.children.entries()) {
                    if (vFive.range.includes(Number(element[1]))) {
                      fiveIndex = kFive;
                      break;
                    }
                  }
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }
      if (queue[String(twoIndex)] == undefined) queue[String(twoIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)] == undefined)
        queue[String(twoIndex)][String(threeIndex)] = {};
      if (
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] ==
        undefined
      )
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] = {};
      if (
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][
          String(fiveIndex)
        ] == undefined
      )
        queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][
          String(fiveIndex)
        ] = [];

      queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][
        String(fiveIndex)
      ].push(element);
    });
    for (const [keyTwo, valueTwo] of Object.entries(queue)) {
      for (const [keyThree, valueThree] of Object.entries(valueTwo)) {
        for (const [keyFour, valueFour] of Object.entries(valueThree)) {
          for (const [keyFive, valueFive] of Object.entries(valueFour)) {
            const k2 = Number(keyTwo);
            const k3 = Number(keyThree);
            const k4 = Number(keyFour);
            const k5 = Number(keyFive);
            let target =
              paragraph[k2].children[k3].children[k4].children[k5].children;
            valueFive.forEach((e, i) => {
              if (i < valueFive.length - 1) {
                // 뒤에 6단계 문장 있음
                target.push(treeStruct(e[2], e[1], valueFive[i + 1][1]));
                return;
              } else if (
                k5 <
                paragraph[k2].children[k3].children[k4].children.length - 1
              ) {
                // 뒤에 6단계 문장 없음 = 다음 5단계 문장의 첫 index 기준 && 뒤에 5단계 문장 있음
                target.push(
                  treeStruct(
                    e[2],
                    e[1],
                    String(
                      paragraph[k2].children[k3].children[k4].children[k5 + 1]
                        .range[0]
                    )
                  )
                );
                return;
              } else if (k4 < paragraph[k2].children[k3].children.length - 1) {
                // 뒤에 5, 6단계 문장 없음 = 다음 4단계 문장의 첫 index 기준 && 뒤에 4단계 문장 있음
                target.push(
                  treeStruct(
                    e[2],
                    e[1],
                    String(paragraph[k2].children[k3].children[k4 + 1].range[0])
                  )
                );
                return;
              } else if (k3 < paragraph[k2].children.length - 1) {
                // 뒤에 4, 5, 6단계 문장 없음 = 다음 3단계 문장의 첫 index 기준 && 뒤에 3단계 문장 있음
                target.push(
                  treeStruct(
                    e[2],
                    e[1],
                    String(paragraph[k2].children[k3 + 1].range[0])
                  )
                );
                return;
              } else if (k2 < paragraph.length - 1) {
                // 뒤에 3, 4, 5, 6단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
                target.push(
                  treeStruct(
                    e[2],
                    e[1],
                    String(Number(paragraph[k2 + 1].range[0]))
                  )
                );
                return;
              } else {
                // 뒤에 2, 3, 4, 5, 6단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
                target.push(
                  treeStruct(
                    e[2],
                    e[1],
                    String(Number(paragraph[k2].range.at(-1)) + 1)
                  )
                );
                return;
              }
            });
          }
        }
      }
    }
    queue = {};
    return;
  };

  const paragraphSort = () => {
    const editor = vscode.window.activeTextEditor;

    if (!isDocumentPerfect) {
      vscode.window.showErrorMessage(
        "문단 구성이 잘못되어 정렬할 수 없습니다. 구성이 올바른지 확인하세요."
      );
      return;
    }

    if (editor) {
      const document = editor.document;
      const titleRegexTwo = /^#(.*)#== (.*) ==$|^#(.*)#==# (.*) #==$/gm;

      let content: string = "";
      const splitter = document
        .getText()
        .split("\n")
        .map((elem, idx) => `#${String(idx).padStart(7, "0")}#` + elem);
      splitter.forEach((elem) => (content += elem + "\n"));
      const analysisTwo = [...content.matchAll(titleRegexTwo)];
      analysisTwo.forEach((element, idx) => {
        // 뒤에 2단계 문단이 존재
        if (idx < analysisTwo.length - 1) {
          paragraph.push(
            treeStruct(element[2], element[1], analysisTwo[idx + 1][1])
          );
        } // 뒤에 2단계 문단 없음 = 끝 문장의 index 기준
        else {
          paragraph.push(
            treeStruct(element[2], element[1], String(splitter.length))
          );
        }
      });

      analyzeThree(content);

      console.log(paragraph);
      vscode.window.showInformationMessage("성공적으로 정렬되었습니다!");
      paragraph = [];
    }
  };

  vscode.commands.registerCommand("namucode.paragraphLevelDown", () => {
    paragraphLeveling(Level.DOWN);
  });

  vscode.commands.registerCommand("namucode.paragraphLevelUp", () => {
    paragraphLeveling(Level.UP);
  });
  const sort = vscode.commands.registerCommand(
    "namucode.paragraphSort",
    paragraphSort
  );

  context.subscriptions.push(sort);
};

// Code to provide shortcuts

const paragraphLeveling = (type: Level) => {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const document = editor.document;
    const lineRange = getSelectedLineRange();

    let lines = document.getText(lineRange).split("\n");
    if (type == Level.UP) {
      const paragraphRegex = /(^(={1,5})(#?) (.*) (\2)(\1)(?<returnChar>\r)?$)/
      for (let i = 0; i < lines.length; i++) {
        const execResult = paragraphRegex.exec(lines[i]);
        console.log(execResult)
        if (execResult !== null) {
          if (execResult.groups?.returnChar === "\r") {
            lines[i] = lines[i].replace("\r", "")
            lines[i] = `=${lines[i]}=\r`
          } else {
            lines[i] = `=${lines[i]}=`
          }
        }
        paragraphRegex.lastIndex = 0;
      }
    } else if (type == Level.DOWN) {
      const paragraphRegex = /(^(={2,6})(#?) (.*) (\2)(\1)(?<returnChar>\r)?$)/
      for (let i = 0; i < lines.length; i++) {
        const execResult = paragraphRegex.exec(lines[i]);
        if (execResult !== null) {
          if (execResult.groups?.returnChar === "\r") {
            lines[i] = lines[i].replace("\r", "")
            lines[i] = `${lines[i].slice(1, -1)}\r`
          } else {
            lines[i] = lines[i].slice(1, -1)
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
  if (word.match(/^'/) && (prefix == "''" || prefix == "'''"))
    prefix = `${prefix} `;
  if (word.match(/'$/) && (postfix == "''" || postfix == "'''"))
    postfix = ` ${postfix}`;

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
  const re = new RegExp(
    `^ *${escapeRegex(prefix)}([^'].*?[^'])${escapeRegex(postfix)} *$`
  );
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
      new LinkDefinitionProvider(
        rule.linkPattern,
        rule.linkPatternFlags,
        rule.linkTarget
      )
    );
  });

  for (const rule of activeRules) {
    context.subscriptions.push(rule);
  }
};

// Code of module function

const escapeRegex = (string) =>
  string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");

const getSelectedLineRange = (): vscode.Range | null => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return null;
  }

  const selection = editor.selection;
  const startLine = selection.start.line;
  const endLine = selection.end.line;

  const start = new vscode.Position(startLine, 0);
  const end = new vscode.Position(
    endLine,
    editor.document.lineAt(endLine).text.length
  );

  return new vscode.Range(start, end);
};

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'client/media')]
	};
}

class MarkPreview {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: MarkPreview | undefined;

	public static readonly viewType = 'markPreview';

	private readonly _panel: vscode.WebviewPanel;
  private readonly _context: ExtensionContext;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(context: ExtensionContext, extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (MarkPreview.currentPanel) {
			MarkPreview.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			MarkPreview.viewType,
			`미리보기 ${path.basename(vscode.window.activeTextEditor.document.fileName)}`,
			vscode.ViewColumn.Beside,
			getWebviewOptions(extensionUri),
		);

		MarkPreview.currentPanel = new MarkPreview(panel, context, extensionUri);
	}

	public static revive(panel: vscode.WebviewPanel, context: ExtensionContext, extensionUri: vscode.Uri) {
		MarkPreview.currentPanel = new MarkPreview(panel, context, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, context: ExtensionContext, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._context = context;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);

    const themeDisposable = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('workbench.colorTheme')) {
        this._update();
      }
    },
    null,
    this._disposables)

    const saveDisposable = vscode.workspace.onDidSaveTextDocument(document => {
      this._update();
    }, null, this._disposables)

    context.subscriptions.push(themeDisposable, saveDisposable)
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		MarkPreview.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
    this._panel.iconPath = (vscode.Uri.joinPath(this._extensionUri, "images/Logo.svg"));
    this._panel.title = `미리보기 ${path.basename(vscode.window.activeTextEditor.document.fileName)}`;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptFuncPath = vscode.Uri.joinPath(this._extensionUri, 'client/media/func.js');
		const scriptRenderPath = vscode.Uri.joinPath(this._extensionUri, 'client/media/render.js');
		const scriptFuncUri = webview.asWebviewUri(scriptFuncPath);
		const scriptRenderUri = webview.asWebviewUri(scriptRenderPath);

		// Local path to css styles
		const stylePath = vscode.Uri.joinPath(this._extensionUri, 'client/media/style.css');
    const styleUri = webview.asWebviewUri(stylePath);
    console.log(scriptFuncUri,scriptFuncUri,styleUri)
		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

    if (!vscode.window.activeTextEditor) {
      return ""
    }

    const text = vscode.window.activeTextEditor.document.getText().replaceAll("\r", "");
    const result = new NamuMark(text, { docName: path.basename(vscode.window.activeTextEditor.document.fileName).split(".")[0], useDarkmode: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark || vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast ? "on" : "off" }, { data: [] }).parse()

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Document</title>

      <script defer id="katex" src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js" integrity="sha512-LQNxIMR5rXv7o+b1l8+N1EZMfhG7iFZ9HhnbJkTp4zjNr5Wvst75AqUeFDxeRUa7l5vEDyUiAip//r+EFLLCyA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script defer id="hljs" src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js" integrity="sha512-rdhY3cbXURo13l/WU9VlaRyaIYeJ/KBakckXIvJNAQde8DgpOmE+eZf7ha4vdqVjTtwQt69bD2wH2LXob/LB7Q==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/languages/x86asm.min.js" integrity="sha512-HeAchnWb+wLjUb2njWKqEXNTDlcd1QcyOVxb+Mc9X0bWY0U5yNHiY5hTRUt/0twG8NEZn60P3jttqBvla/i2gA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script defer src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.48.0/min/vs/loader.min.js" integrity="sha512-ZG31AN9z/CQD1YDDAK4RUAvogwbJHv6bHrumrnMLzdCrVu4HeAqrUX7Jsal/cbUwXGfaMUNmQU04tQ8XXl5Znw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
      <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlightjs-line-numbers.js/2.8.0/highlightjs-line-numbers.min.js"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css" integrity="sha512-fHwaWebuwA7NSF5Qg/af4UeDx9XqUpYpOGgubo3yWu+b2IQR4UeQwbb42Ti7gVAjNtVoI/I9TEoYeu9omwcC6g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/default.min.css" integrity="sha512-hasIneQUHlh06VNBe7f6ZcHmeRTLIaQWFd43YriJ0UND19bvYRauxthDg8E4eVNPm9bRUhr5JGeqH7FRFXQu5g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.41.0/min/vs/editor/editor.main.min.css" integrity="sha512-MFDhxgOYIqLdcYTXw7en/n5BshKoduTitYmX8TkQ+iJOGjrWusRi8+KmfZOrgaDrCjZSotH2d1U1e/Z1KT6nWw==" crossorigin="anonymous" referrerpolicy="no-referrer" />

      <link rel="stylesheet" href="${styleUri}">
      <script defer nonce="${nonce}" src="${scriptFuncUri}"></script>
      <script defer nonce="${nonce}" src="${scriptRenderUri}"></script>
    </head>
    <body>
      <section>
        <article class="main" id="main_data">
          <div class="opennamu_render_complete">
            ${result[0] /* html 코드 */}
          </div>
        </article>
      </section>
      <script>
        ${result[1] /* js 코드 */}
      </script> 
    </body>
    </html>
    `
  }
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
