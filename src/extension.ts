// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

var isDocumentPerfect = true;

export function activate(context: vscode.ExtensionContext) {
  modifyParagraph();

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
  vscode.window.onDidChangeActiveTextEditor(organizeToc);
  vscode.workspace.onDidOpenTextDocument(organizeToc);
  vscode.workspace.onDidChangeTextDocument(organizeToc);
}

function modifyParagraph() {
  enum Level {
    UP,
    DOWN,
  }

  const paragraphLeveling = (type: Level) => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const document = editor.document;
      const selection = editor.selection;

      const titleRegex =
        /(^== .* ==$|^=== .* ===$|^==== .* ====$|^===== .* =====$|^====== .* ======$|^==# .* #==$|^===# .* #===$|^====# .* #====$|^=====# .* #=====$|^======# .* #======$)/gm;

      const fakeTitleRegex =
        /(^## .* ##$|^### .* ###$|^#### .* ####$|^##### .* #####$|^###### .* ######$|^### .* ###$|^#### .* ####$|^##### .* #####$|^###### .* ######$|^####### .* #######$)/gm;
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
        let originalLevel = (
          original.match(titleLevelCountRegex) as RegExpMatchArray
        )[0];

        // 문단 레벨 Down 시
        if (type == Level.DOWN && original.match(titleLeastRegex) == null) {
          originalChanged = original.replaceAll(
            originalLevel,
            originalLevel.replace("=", "")
          );
        }
        // 문단 레벨 UP 시
        else if (type == Level.UP && original.match(titleMostRegex) == null) {
          originalChanged = original.replaceAll(
            originalLevel,
            originalLevel.replace("=", "==")
          );
        } else {
          originalChanged = original;
        }

        selectionStringify = selectionStringify.replace(
          original,
          originalChanged.replaceAll("=", "#")
        );
      }

      // 동일한 목차일시 타이틀이 하나로 인식이 되는 문제가 있음
      const fakeTitle = [...selectionStringify.matchAll(fakeTitleRegex)];
      for (let i = 0; i < fakeTitle.length; i++) {
        selectionStringify = selectionStringify.replace(
          fakeTitle[i][0],
          fakeTitle[i][0].replaceAll("#", "=")
        );
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

  const treeStruct = (name: string, range1: string, range2: string, children?: []) => {
    const length = Number(range2) - Number(range1)
    let child: typeTreeStruct[] = [];
    if (children != undefined) child = children;
    return {title: name, range: [...Array(length).keys()].map((e)=>e+Number(range1)), children: child}
  }
  const paragraphSort = () => {
    const editor = vscode.window.activeTextEditor;

    if (!isDocumentPerfect) return

    if (editor) {
      const document = editor.document;
      const titleRegex_Two = /^#(.*)#== (.*) ==$|^#(.*)#==# (.*) #==$/gm;
      const titleRegex_Three = /^#(.*)#=== (.*) ===$|^#(.*)#===# (.*) #===$/gm;
      const titleRegex_Four = /^#(.*)#==== (.*) ====$|^#(.*)#====# (.*) #====$/gm;
      const titleRegex_Five = /^#(.*)#===== (.*) =====$|^#(.*)#=====# (.*) #=====$/gm;
      const titleRegex_Six = /^#(.*)#====== (.*) ======$|^#(.*)#======# (.*) #======$/gm;

      let content: string = ''
      const splitter = document.getText().split('\n').map((elem, idx) => `#${String(idx).padStart(7, "0")}#` + elem)
      splitter.forEach((elem) => content += elem + "\n")
      let paragraph: typeTreeStruct[] = []
      const analysis_two = [...content.matchAll(titleRegex_Two)]
      analysis_two.forEach((element, idx) => {
        if (idx < analysis_two.length - 1) {
          paragraph.push(treeStruct(element[2], analysis_two[idx][1], analysis_two[idx+1][1]))
        } else {
          paragraph.push(treeStruct(element[2], analysis_two[idx][1], String(splitter.length)))
        }
      });
      // const analysis_three = [...content.matchAll(titleRegex_Three)]
      // analysis_three.forEach((element, idx) => {
      //   let pindex = 0;
      //   paragraph.forEach((e, i)=>{
      //     if (e['range'].includes(Number(element))) {
      //       pindex = i
      //     }
      //   })
      //   if (idx < analysis_three.length - 1) {
      //     paragraph[pindex].children.push(treeStruct(element[2], analysis_three[idx][1], analysis_three[idx+1][1]))
      //   } else {
      //     paragraph[pindex].children.push(treeStruct(element[2], analysis_three[idx][1], String(splitter.length)))
      //   }
      // })
    }
  };

  vscode.commands.registerCommand("namucode.paragraphLevelDown", () => {
    paragraphLeveling(Level.DOWN);
  });

  vscode.commands.registerCommand("namucode.paragraphLevelUp", () => {
    paragraphLeveling(Level.UP);
  });

  vscode.commands.registerCommand("namucode.paragraphSort", paragraphSort);
}

const organizeToc = () => {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const document = editor.document;
    const titleRegex =
      /(^== .* ==$|^=== .* ===$|^==== .* ====$|^===== .* =====$|^====== .* ======$|^==# .* #==$|^===# .* #===$|^====# .* #====$|^=====# .* #=====$|^======# .* #======$)/gm;
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
      const level = (
        original.match(titleLevelCountRegex) as RegExpMatchArray
      )[0].length;
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
            const propertyp4 = (dataObject[step1].children as TreeItem[])[
              step2
            ];
            if ("children" in propertyp4) {
              propertyp4.children?.push(bstr(name, index));
              step3 = (propertyp4.children?.length as number) - 1;
            }
            break;
          case 5:
            const propertyp5 = (
              (dataObject[step1].children as TreeItem[])[step2]
                .children as TreeItem[]
            )[step3];
            if ("children" in propertyp5) {
              propertyp5.children?.push(bstr(name, index));
              step4 = (propertyp5.children?.length as number) - 1;
            }
            break;
          case 6:
            const propertyp6 = (
              (
                (dataObject[step1].children as TreeItem[])[step2]
                  .children as TreeItem[]
              )[step3].children as TreeItem[]
            )[step4];
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

    if (dataObject.length == 0) isDocumentPerfect = false;
    else isDocumentPerfect = true;

    vscode.window.registerTreeDataProvider(
      "tableOfContent",
      new OutlineProvider(dataObject)
    );
  }
};

class OutlineProvider implements vscode.TreeDataProvider<any> {
  constructor(private outline: any) {}

  getTreeItem(item: any): vscode.TreeItem {
    const treeitem = new vscode.TreeItem(
      item.label,
      item.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
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
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.children = children;
  }
}

export function deactivate() {}
