/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { getConfig } from "./config";
import { LinkDefinitionProvider } from "./providers/LinkDefinitionProvider";
import { MarkPreview, getWebviewOptions } from './preview';
import { WikiCodeActionProvider } from './providers/CodeActionProvider';
import { sortParagraph } from './sortParagraph';
import { registerCompletionProviders, serverCompletionMiddleware } from './providers/CompletionProvider';

export let client: LanguageClient;
let activeRules: vscode.Disposable[] = [];
enum Level {
  UP,
  DOWN,
}
let oldDomain = vscode.workspace.getConfiguration("namucode").get<string>("editor.internalLinkDomain", "https://namu.wiki")

export async function activate(context: ExtensionContext) {
  provideLink(context);

  // namucode.editor.internalLinkDomain 변경 감지
  const linkDomainChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("namucode")) {
      const config = vscode.workspace.getConfiguration("namucode");
      const newDomain = config.get<string>("editor.internalLinkDomain", "https://namu.wiki");
      if (oldDomain !== newDomain) {
        oldDomain = newDomain;
        provideLink(context)
      }
    }
  })

  context.subscriptions.push(linkDomainChangeListener)
  
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

  const preview = vscode.commands.registerCommand("namucode.preview", async ({ retry = false, editorComment = false }) => {
    const editor = vscode.window.activeTextEditor;

    if (retry) {
      if (!MarkPreview.currentActivePanelId) {
        vscode.window.showWarningMessage('현재 열려 있는 미리보기 탭이 없습니다.');
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
          // console.log(`Got state: ${state}`);
          // Reset the webview options so we use latest uri for `localResourceRoots`.
          webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
          MarkPreview.revive(webviewPanel, context, context.extensionUri, "namucode-webview-" + filePath);
        },
      });
    }
  }

  const retryPreview = vscode.commands.registerCommand("namucode.retryPreview", () => {
    vscode.commands.executeCommand('namucode.preview', { retry: true });
  });

  const previewEditorComment = vscode.commands.registerCommand("namucode.previewEditorComment", () => {
    vscode.commands.executeCommand('namucode.preview', { retry: true, editorComment: true });
  });

  const openPreviewInWeb = vscode.commands.registerCommand("namucode.openPreviewInWeb", () => {
    if (!MarkPreview.currentActivePanelId) {
      vscode.window.showWarningMessage('현재 열려 있는 미리보기 탭이 없습니다.');
      return;
    }
    MarkPreview.openInWeb(MarkPreview.currentActivePanelId, context.extensionUri);
  });

  const sort = vscode.commands.registerCommand("namucode.paragraphSort", async () => { await sortParagraph() });

  const wrapCommand = vscode.commands.registerCommand("namucode.wrapSelection", async (document: vscode.TextDocument, range: vscode.Range) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selected = document.getText(range);
    const options = [
      { label: "#!wiki 구문", detail: "{{{#!wiki }}}", code: `{{{#!wiki \n${selected}\n}}}` },
      { label: "#!style 구문", detail: "{{{#!style }}}", code: `{{{#!style\n${selected}\n}}}` },
      { label: "#!folding 구문", detail: "{{{#!folding }}}", code: `{{{#!folding \n${selected}\n}}}` },
      { label: "#!if 구문", detail: "{{{#!if }}}", code: `{{{#!if \n${selected}\n}}}` },
      { label: "#!syntax 구문", detail: "{{{#!syntax }}}", code: `{{{#!syntax \n${selected}\n}}}` },
      { label: "#!html 구문", detail: "{{{#!html }}}", code: `{{{#!html ${selected}}}}` },
      { label: "#!latex 구문", detail: "{{{#!latex }}}", code: `{{{#!latex\n${selected}}}}` },
      { label: "삼중괄호 구문", detail: "{{{ }}}", code: `{{{${selected}}}}` },
    ];

    const picked = await vscode.window.showQuickPick(options, {
      placeHolder: "감쌀 위키 구문을 선택하세요",
      matchOnDescription: true,
    });

    if (picked) {
      // 선택한 구문으로 텍스트 치환
      editor.edit((editBuilder) => {
        editBuilder.replace(range, picked.code);
      });
    }
  });

  context.subscriptions.push(preview, retryPreview, previewEditorComment, openPreviewInWeb, sort, wrapCommand);

  registerCompletionProviders(context);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'namu' },
      new WikiCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.RefactorRewrite] }
    )
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
    middleware: {
      provideCompletionItem: serverCompletionMiddleware,
    },
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.namu"),
    },
  };
  client = new LanguageClient("Namucode", serverOptions, clientOptions);
  await client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

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