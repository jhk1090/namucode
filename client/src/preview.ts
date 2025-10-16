import * as path from "path";
import * as vscode from "vscode"
import { ExtensionContext } from "vscode";
import fs from "fs";

export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    // Enable javascript in the webview
    enableScripts: true,

    // And restrict the webview to only loading content from our extension's `media` directory.
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "client/out"), vscode.Uri.joinPath(extensionUri, "client/out/assets"),  vscode.Uri.joinPath(extensionUri, "client/out/assets/fonts"),  vscode.Uri.joinPath(extensionUri, "client/out/assets/fonts/katex")],
  };
}

export class MarkPreview {
  public static currentPanels: { [key: string]: MarkPreview | undefined } = {};

  private readonly _panel: vscode.WebviewPanel;
  private readonly _context: ExtensionContext;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(context: ExtensionContext, extensionUri: vscode.Uri, panelId: string) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If we already have a panel, show it.
    if (MarkPreview.currentPanels[panelId]) {
      MarkPreview.currentPanels[panelId]._panel.reveal();
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      panelId,
      `${path.basename(vscode.window.activeTextEditor.document.fileName)} (미리보기)`,
      vscode.ViewColumn.Beside,
      getWebviewOptions(extensionUri)
    );

    MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId);
  }

  public static revive(panel: vscode.WebviewPanel, context: ExtensionContext, extensionUri: vscode.Uri, panelId: string) {
    MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId);
  }

  private constructor(panel: vscode.WebviewPanel, context: ExtensionContext, extensionUri: vscode.Uri, panelId: string) {
    this._panel = panel;
    this._context = context;
    this._extensionUri = extensionUri;
    console.log(path.basename(panelId), "just updated!");
    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(panelId), null, this._disposables);

    const themeDisposable = vscode.workspace.onDidChangeConfiguration(
      (event) => {
        if (event.affectsConfiguration("workbench.colorTheme")) {
          console.log(path.basename(panelId), "just updated!", "in theme state");
          this._update();
        }
      },
      null,
      this._disposables
    );

    const saveDisposable = vscode.workspace.onDidSaveTextDocument(
      (document) => {
        if (panelId === document.fileName) {
          console.log(path.basename(panelId), "just updated!", "in save state");
          this._update();
        }
      },
      null,
      this._disposables
    );

    context.subscriptions.push(themeDisposable, saveDisposable);
  }

  public dispose(panelId: string) {
    MarkPreview.currentPanels[panelId] = undefined;

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
    this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, "images/Logo.svg");
    this._panel.title = `${path.basename(vscode.window.activeTextEditor.document.fileName)} (미리보기)`;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
		const vueAppUri = webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri, "client/out/client/vite-project.mjs"
			)
		)

    const styleUriList = []
    for (const css of ["default.css", "github-dark-dimmed.min.css", "github.min.css", "ionicons.min.css", "katex.min.css", "wiki.css"]) {
      styleUriList.push(webview.asWebviewUri(
			vscode.Uri.joinPath(
				this._extensionUri, "client/out/client/assets/css/" + css
			)
		))
    }

    const stylesheetFlatten = styleUriList.map(v => `<link href="${v}" rel="stylesheet" />`).map(v => v.toString()).join("\n")

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    if (!vscode.window.activeTextEditor) {
      return "";
    }

    const document = vscode.window.activeTextEditor.document

    const text = document.getText();
    const result = `<div class="wiki-paragraph"></div><div class="wiki-paragraph"></div><div class="wiki-paragraph"></div><div class="wiki-paragraph"><br><div class="wiki-macro-toc"><div class="toc-indent"><span class="toc-item"><a href="#s-1">1</a>. 개요</span></div></div></div><h2 class="wiki-heading"><a id="s-1" href="#toc">1.</a> <span id="개요">개요</span></h2><div class="wiki-heading-content"><div class="wiki-paragraph"><a href="/w/나무위키" title="나무위키" class="not-exist wiki-link-internal" rel="nofollow">나무위키</a>의 문법 도움말입니다. <a href="/w/the seed" title="the seed" class="not-exist wiki-link-internal" rel="nofollow">나무위키가 사용하는 위키 엔진</a>이 제공하는 문법이라 하여 &#039;나무마크&#039;라고도 합니다.<br><br>이 문서에서는 기본적인 수준의 위키 <a href="/w/문법" title="문법" class="not-exist wiki-link-internal" rel="nofollow">문법</a>들을 정리했으며, <a href="/w/나무위키:문법 도움말/심화" title="나무위키:문법 도움말/심화" class="not-exist wiki-link-internal" rel="nofollow">나무위키:문법 도움말/심화</a> 문서에서 고급 문법을 확인하실 수 있습니다. <a href="/w/나무위키:문법 도움말/개발" title="나무위키:문법 도움말/개발" class="not-exist wiki-link-internal" rel="nofollow">나무위키:문법 도움말/개발</a> 문서에서는 위키 문법을 처리하는 원리 등을 설명합니다.</div></div>`

		webview.postMessage({ type: "updateContent", newContent: result })

    return `
    <!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="utf-8" />

				<meta http-equiv="Content-Security-Policy" content="default-src 'none';
						style-src ${webview.cspSource};
						img-src ${webview.cspSource};
            font-src ${webview.cspSource};
						script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

        ${stylesheetFlatten}

				<title>Json Editor</title>
		</head>
		<body>
				<div id="app"></div>
				<script nonce="${nonce}">
						const vscode = acquireVsCodeApi();
				</script>
				<script type="text/javascript" src="${vueAppUri}" nonce="${nonce}"></script>
		</body>
		</html>
    `;
  }
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}