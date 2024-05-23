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
          const symbol = new TreeSymbol(
            match[3],
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
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/(^(={1,5})(#?) (.*) (\2)(\1)$)/)) {
          lines[i] = `=${lines[i]}=`;
        }
      }
    } else if (type == Level.DOWN) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/(^(={2,6})(#?) (.*) (\2)(\1)$)/)) {
          lines[i] = lines[i].slice(1, -1);
        }
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
