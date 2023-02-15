// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

var isDocumentPerfect = true;

export function activate(context: vscode.ExtensionContext) {
  modifyParagraph(context);

  vscode.commands.registerCommand("namucode.linkify", () => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const document = editor.document;
      const selection = editor.selection;
      const word = document.getText(selection);
      const linkify = `[[${word}]]`;
      editor.edit((editBuilder) => {
        editBuilder.replace(selection, linkify);
      });
    }
  });

  vscode.commands.registerCommand("namucode.gotoLine", (line: number) => {
    vscode.commands.executeCommand("revealLine", {
      lineNumber: line,
      at: "top",
    });
  });
  
  vscode.workspace.onDidChangeTextDocument(organizeToc);
}

function modifyParagraph(context: vscode.ExtensionContext) {
  enum Level {
    UP,
    DOWN,
  }

  const paragraphLeveling = (type: Level) => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const document = editor.document;
      const selection = editor.selection;

      const titleRegex = /(^== .* ==$|^=== .* ===$|^==== .* ====$|^===== .* =====$|^====== .* ======$|^==# .* #==$|^===# .* #===$|^====# .* #====$|^=====# .* #=====$|^======# .* #======$)/gm;

      const fakeTitleRegex = /(^№№ .* №№$|^№№№ .* №№№$|^№№№№ .* №№№№$|^№№№№№ .* №№№№№$|^№№№№№№ .* №№№№№№$|^№№# .* #№№$|^№№№# .* #№№№$|^№№№№# .* #№№№№$|^№№№№№# .* #№№№№№$|^№№№№№№# .* #№№№№№№$)/gm;
      // 최소 문단 레벨
      const titleLeastRegex = /(^== .* ==$|^==# .* #==)/gm;
      // 최대 문단 레벨
      const titleMostRegex = /(^====== .* ======$|^======# .* #======$)/gm;
      // 문단 레벨 카운트용
      const titleLevelCountRegex = /^={2,6}/gm;
      // 문단 얻기
      const titles = [...document.getText(selection).matchAll(titleRegex)];
      let selectionStringify = document.getText(selection);

      for (let i = 0; i < titles.length; i++) {
        // 원본
        const original = titles[i][0];
        let originalChanged = "";
        let originalLevel = (original.match(titleLevelCountRegex) as RegExpMatchArray)[0];

        // 문단 레벨 Down 시
        if (type == Level.DOWN && original.match(titleLeastRegex) == null) {
          originalChanged = original.replaceAll(originalLevel, originalLevel.replace("=", ""));
        }
        // 문단 레벨 UP 시
        else if (type == Level.UP && original.match(titleMostRegex) == null) {
          originalChanged = original.replaceAll(originalLevel, originalLevel.replace("=", "=="));
        } else {
          originalChanged = original;
        }

        selectionStringify = selectionStringify.replace(original, originalChanged.replaceAll("=", "№"));
      }

      // 동일한 목차일시 타이틀이 하나로 인식이 되는 문제가 있음
      const fakeTitle = [...selectionStringify.matchAll(fakeTitleRegex)];
      for (let i = 0; i < fakeTitle.length; i++) {
        console.log(i, fakeTitle[i][0])
        selectionStringify = selectionStringify.replace(fakeTitle[i][0], fakeTitle[i][0].replaceAll("№", "="));
      }
      editor.edit((editBuilder) => {
        editBuilder.replace(selection, selectionStringify);
      });
    }
  };

  interface typeTreeStruct {
    title: string;
    range: number[];
    children: typeTreeStruct[];
  }

  var paragraph: typeTreeStruct[] = [];

  const treeStruct = (name: string, range1: string, range2: string, children?: []) => {
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
        if (i < value.length - 1) paragraph[Number(key)].children.push(treeStruct(e[2], e[1], value[i + 1][1]));
        else if (Number(key) < paragraph.length - 1)
          // 뒤에 3단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
          paragraph[Number(key)].children.push(treeStruct(e[2], e[1], String(paragraph[Number(key) + 1].range[0])));
        // 뒤에 2, 3단계 문장 없음 = 현재 2단계 문장의 끝 index 기준
        else paragraph[Number(key)].children.push(treeStruct(e[2], e[1], String(Number(paragraph[Number(key)].range.at(-1)) + 1)));
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
      if (queue[String(twoIndex)][String(threeIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)] = [];

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
            target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3 + 1].range[0])));
            return;
          } else if (k2 < paragraph.length - 1) {
            // 뒤에 3, 4단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
            target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2 + 1].range[0]))));
            return;
          } else {
            // 뒤에 2, 3, 4단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
            target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2].range.at(-1)) + 1)));
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
    const titleRegexFive = /^#(.*)#===== (.*) =====$|^#(.*)#=====# (.*) #=====$/gm;
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
      if (queue[String(twoIndex)][String(threeIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] = [];

      queue[String(twoIndex)][String(threeIndex)][String(fourIndex)].push(element);
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
              target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3].children[k4 + 1].range[0])));
              return;
            } else if (k3 < paragraph[k2].children.length - 1) {
              // 뒤에 4, 5단계 문장 없음 = 다음 3단계 문장의 첫 index 기준 && 뒤에 3단계 문장 있음
              target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3 + 1].range[0])));
              return;
            } else if (k2 < paragraph.length - 1) {
              // 뒤에 3, 4, 5단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
              target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2 + 1].range[0]))));
              return;
            } else {
              // 뒤에 2, 3, 4, 5단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
              target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2].range.at(-1)) + 1)));
              return;
            }
          });
        }
      }
    }

    queue = {};
    analyzeSix(content)
    return;
  };

  const analyzeSix = (content: string) => {
    const titleRegexSix = /^#(.*)#====== (.*) ======$|^#(.*)#======# (.*) #======$/gm;
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
      if (queue[String(twoIndex)][String(threeIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)][String(fourIndex)] = {};
      if (queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][String(fiveIndex)] == undefined) queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][String(fiveIndex)] = [];

      queue[String(twoIndex)][String(threeIndex)][String(fourIndex)][String(fiveIndex)].push(element);
    });
    for (const [keyTwo, valueTwo] of Object.entries(queue)) {
      for (const [keyThree, valueThree] of Object.entries(valueTwo)) {
        for (const [keyFour, valueFour] of Object.entries(valueThree)) {
          for (const [keyFive, valueFive] of Object.entries(valueFour)) {
            const k2 = Number(keyTwo);
            const k3 = Number(keyThree);
            const k4 = Number(keyFour);
            const k5 = Number(keyFive);
            let target = paragraph[k2].children[k3].children[k4].children[k5].children;
            valueFive.forEach((e, i) => {
              if (i < valueFive.length - 1) {
                // 뒤에 6단계 문장 있음
                target.push(treeStruct(e[2], e[1], valueFive[i + 1][1]))
                return;
              }else if (k5 < paragraph[k2].children[k3].children[k4].children.length - 1) {
                // 뒤에 6단계 문장 없음 = 다음 5단계 문장의 첫 index 기준 && 뒤에 5단계 문장 있음
                target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3].children[k4].children[k5 + 1].range[0])));
                return;
              }else if (k4 < paragraph[k2].children[k3].children.length - 1) {
                // 뒤에 5, 6단계 문장 없음 = 다음 4단계 문장의 첫 index 기준 && 뒤에 4단계 문장 있음
                target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3].children[k4 + 1].range[0])));
                return;
              } else if (k3 < paragraph[k2].children.length - 1) {
                // 뒤에 4, 5, 6단계 문장 없음 = 다음 3단계 문장의 첫 index 기준 && 뒤에 3단계 문장 있음
                target.push(treeStruct(e[2], e[1], String(paragraph[k2].children[k3 + 1].range[0])));
                return;
              } else if (k2 < paragraph.length - 1) {
                // 뒤에 3, 4, 5, 6단계 문장 없음 = 다음 2단계 문장의 첫 index 기준 && 뒤에 2단계 문장 있음
                target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2 + 1].range[0]))));
                return;
              } else {
                // 뒤에 2, 3, 4, 5, 6단계 문장 없음 = 다음 2단계 문장의 끝 index 기준
                target.push(treeStruct(e[2], e[1], String(Number(paragraph[k2].range.at(-1)) + 1)));
                return;
              }
            });
          }
        }
      }
    }
    queue = {}
    return;
  };

  const paragraphSort = () => {
    const editor = vscode.window.activeTextEditor;

    if (!isDocumentPerfect) {
      vscode.window.showErrorMessage('문단 구성이 잘못되어 정렬할 수 없습니다. 구성이 올바른지 확인하세요.');
      return
    };

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
          paragraph.push(treeStruct(element[2], element[1], analysisTwo[idx + 1][1]));
        } // 뒤에 2단계 문단 없음 = 끝 문장의 index 기준
        else {
          paragraph.push(treeStruct(element[2], element[1], String(splitter.length)));
        }
      });

      analyzeThree(content);

      console.log(paragraph);
      vscode.window.showInformationMessage('성공적으로 정렬되었습니다!');
      paragraph = [];
    }
  };

  vscode.commands.registerCommand("namucode.paragraphLevelDown", () => {
    paragraphLeveling(Level.DOWN);
  });

  vscode.commands.registerCommand("namucode.paragraphLevelUp", () => {
    paragraphLeveling(Level.UP);
  });

  const sort = vscode.commands.registerCommand("namucode.paragraphSort", paragraphSort);

  context.subscriptions.push(sort)
}

const organizeToc = () => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const titleRegex = /(^== .* ==$|^=== .* ===$|^==== .* ====$|^===== .* =====$|^====== .* ======$|^==# .* #==$|^===# .* #===$|^====# .* #====$|^=====# .* #=====$|^======# .* #======$)/gm;
    const titles = [...document.getText().matchAll(titleRegex)];
    const titleLevelCountRegex = /^={2,6}/gm;
    const titleTextRegex = /(?<=^\={2,6}(#)? ).[^=]*(?= (#)?\={2,6}$)/gm;
    let dataObject: TreeItem[] = [];
    function bstr(labelname: string, index: number): TreeItem {
      return {
        label: labelname,
        children: [],
        command: {
          command: "namucode.gotoLine",
          title: "문단으로 이동",
          arguments: [editor?.document.positionAt(index).line as number],
        },
      };
    }
    let step1 = -1;
    let step2 = -1;
    let step3 = -1;
    let step4 = -1;
    for (let i = 0; i < titles.length; i++) {
      const original = titles[i][0];
      const index = titles[i]["index"] as number;
      const level = (original.match(titleLevelCountRegex) as RegExpMatchArray)[0].length;
      const name = (original.match(titleTextRegex) as RegExpMatchArray)[0];
      step1 = dataObject.length - 1;
      try {
        switch (level) {
          case 2:
            dataObject.push(bstr(name, index));
            break;
          case 3:
            if ("children" in dataObject[step1]) {
              dataObject[step1].children?.push(bstr(name, index));
              step2 = (dataObject[step1].children?.length as number) - 1;
            }
            break;
          case 4:
            const propertyp4 = (dataObject[step1].children as TreeItem[])[step2];
            if ("children" in propertyp4) {
              propertyp4.children?.push(bstr(name, index));
              step3 = (propertyp4.children?.length as number) - 1;
            }
            break;
          case 5:
            const propertyp5 = ((dataObject[step1].children as TreeItem[])[step2].children as TreeItem[])[step3];
            if ("children" in propertyp5) {
              propertyp5.children?.push(bstr(name, index));
              step4 = (propertyp5.children?.length as number) - 1;
            }
            break;
          case 6:
            const propertyp6 = (((dataObject[step1].children as TreeItem[])[step2].children as TreeItem[])[step3].children as TreeItem[])[step4];
            if ("children" in propertyp6) {
              propertyp6.children?.push(bstr(name, index));
            }
            break;
          default:
            break;
        }
      } catch (error) {
        // 오류 발생 시 Welcome 스크린 표시
        dataObject = [];
        break;
      }
      // console.log(step1, step2, step3, step4, Date.now()+Math.random())
      // console.log(dataObject)
    }

    if (dataObject.length === 0) {
      isDocumentPerfect = false;
    } else {
      isDocumentPerfect = true;
    }

    vscode.window.registerTreeDataProvider("tableOfContent", new OutlineProvider(dataObject));
  }
};

class OutlineProvider implements vscode.TreeDataProvider<any> {
  constructor(private outline: any) {}

  getTreeItem(item: any): vscode.TreeItem {
    const treeitem = new vscode.TreeItem(item.label, item.children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    treeitem.command = item.command;
    return treeitem;
  }

  getChildren(element?: any): Thenable<[]> {
    if (element) {
      return Promise.resolve(element.children);
    } else {
      return Promise.resolve(this.outline);
    }
  }
}

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

  constructor(label: string, children?: TreeItem[]) {
    super(label, children === undefined ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
    this.children = children;
  }
}

export function deactivate() {}
