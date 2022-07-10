// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { title } from "process";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  enum Level {
    UP,
    DOWN,
  }

  const paragraphLeveling = (type: Level) => {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
      const document = editor.document;
      const selection = editor.selection;
      const titleRegex = /^={2,6} .* ={2,6}$/gm;
      // 최소 문단 레벨
      const titleLeastRegex = /^== .* ==$/gm;
      // 최대 문단 레벨
      const titleMostRegex = /^====== .* ======$/gm;
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
          originalChanged
        );
      }
      editor.edit((editBuilder) => {
        editBuilder.replace(selection, selectionStringify);
      });
    }
  };

  const paragraphLevelDown = vscode.commands.registerCommand(
    "namucode.paragraphLevelDown",
    () => {
      paragraphLeveling(Level.DOWN);
    }
  );

  const paragraphLevelUp = vscode.commands.registerCommand(
    "namucode.paragraphLevelUp",
    () => {
      paragraphLeveling(Level.UP);
    }
  );

  const linkify = vscode.commands.registerCommand("namucode.linkify", () => {
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
  const toc = vscode.commands.registerCommand("namucode.refresh", async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const document = editor.document;
      const titleRegex = /^={2,6} .* ={2,6}$/gm;
      const titles = [...document.getText().matchAll(titleRegex)];
      const titleLevelCountRegex = /^={2,6}/gm;
      const titleTextRegex = /(?<=^\={2,6} ).[^=]*(?=\={2,6}$)/gm;

      let dataObject: TreeItem[] = [];
      function bstr(labelname: string): TreeItem {
        return {
          label: labelname,
          children: [],
        };
      }
      let step1 = -1;
      let step2 = -1;
      let step3 = -1;
      let step4 = -1;
      for (let i = 0; i < titles.length; i++) {
        const original = titles[i][0];
        const level = (
          original.match(titleLevelCountRegex) as RegExpMatchArray
        )[0].length;
        const name = (original.match(titleTextRegex) as RegExpMatchArray)[0];
        step1 = dataObject.length - 1;
        try {
          switch (level) {
            case 2:
              dataObject.push(bstr(name));
              break;
            case 3:
              if ("children" in dataObject[step1]) {
                dataObject[step1].children?.push(bstr(name));
                step2 = (dataObject[step1].children?.length as number) - 1;
              }
              break;
            case 4:
              const propertyp4 = (dataObject[step1].children as TreeItem[])[step2]
              if ("children" in propertyp4) {
                propertyp4.children?.push(bstr(name));
                step3 = (propertyp4.children?.length as number) - 1;
              }
              break;
            case 5:
              const propertyp5 = ((dataObject[step1].children as TreeItem[])[step2].children as TreeItem[])[step3]
              if ("children" in propertyp5) {
                propertyp5.children?.push(bstr(name));
                step4 = (propertyp5.children?.length as number) - 1;
              }
              break;
            case 6:
              const propertyp6 = (((dataObject[step1].children as TreeItem[])[step2].children as TreeItem[])[step3].children as TreeItem[])[step4]
              if ("children" in propertyp6) {
                propertyp6.children?.push(bstr(name));
              }
              break;
            default:
              break;
          }
        } catch (error) {
            vscode.window.showErrorMessage('문단 조직이 잘못되어 목차가 표시되지 않았습니다. (최상위 문단은 2단계 문단입니다.)');
            return;
        }
      }

      vscode.window.registerTreeDataProvider(
        "tableOfContent",
        new OutlineProvider(dataObject)
      );
    }
  });

  class OutlineProvider implements vscode.TreeDataProvider<TreeItem> {
    constructor(private outline: any) {
      console.log(outline);
    }

    getTreeItem(item: any): vscode.TreeItem {
      return new vscode.TreeItem(
        item.label,
        item.children.length > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.None
      );
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
}

export function deactivate() {}
