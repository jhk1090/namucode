// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
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
}

export function deactivate() {}
