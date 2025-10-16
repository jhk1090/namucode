import * as path from "path";
import * as vscode from "vscode"
import { ExtensionContext } from "vscode";
import { toHtml, parser } from "../media/parser"
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
    const parsed = parser(text)
    toHtml(parsed, { namespace: '문서', title: 'Document' }).then(result => {
      console.log(result)
      webview.postMessage({ type: "updateContent", newContent: result.html  })
    })

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