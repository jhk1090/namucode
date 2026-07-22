import * as vscode from "vscode"

export class WikiCodeActionProvider implements vscode.CodeActionProvider {
    provideCodeActions(
      document: vscode.TextDocument,
      range: vscode.Range | vscode.Selection,
      context: vscode.CodeActionContext,
      token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
      const actions: vscode.CodeAction[] = [];
      const text = document.getText();
      const cursorOffset = document.offsetAt(range.start);

      // Code Action: Wrap
      if (!range.isEmpty) {
        const wrapAction = new vscode.CodeAction("선택 영역 구문 감싸기", vscode.CodeActionKind.RefactorRewrite)

        wrapAction.command = {
          command: 'namucode.wrapSelection',
          title: "선택 영역 구문 감싸기",
          arguments: [document, range]
        }

        actions.push(wrapAction)
      }

      // Code Action: Unwrap
      const tokenRegex = /\{\{\{|\}\}\}/g;
      const stack: number[] = [];
      let match, foundBlock: { start: number; end: number } | null = null;
      let minLength = Infinity;
      
      // Block 찾기
      while ((match = tokenRegex.exec(text)) !== null) {
        if (match[0] === '{{{') {
          stack.push(match.index);
        } else if (stack.length > 0) {
          const start = stack.pop()!;
          const end = match.index + 3;
          if (start <= cursorOffset && cursorOffset <= end && end - start < minLength) {
            minLength = end - start;
            foundBlock = { start, end };
          }
        }
      }
      
      // Block 해제
      if (foundBlock) {
        const { start, end } = foundBlock;
        const blockText = text.substring(start, end);
        
        const startRegex = /^\{\{\{(?:#!([^\r\n]*)\r?\n|([+\-#][^\s]*)\s?|)/;
        const kindMatch = blockText.match(startRegex);
        
        let kind = "삼중괄호";
        if (kindMatch) {
          if (kindMatch[1]) kind = kindMatch[1].split(' ')[0];
          else if (kindMatch[2]) kind = kindMatch[2];
        }

        const unwrapped = blockText
          .replace(startRegex, '')
          .replace(/(?:\r?\n[ \t]*)?\}\}\}$/, '');

        const action = new vscode.CodeAction(`현재 위치한 구문 벗기기: ${kind} 구문`, vscode.CodeActionKind.RefactorRewrite);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(end)), unwrapped);

        actions.push(action);
      }

      return actions;
    }
  }