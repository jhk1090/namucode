import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { ParserWorkerManager, ToHtmlWorkerManager } from './previewWorker';
import { parser } from "../media/parser/index.js"

export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, "client/out"),
            vscode.Uri.joinPath(extensionUri, "client/out/assets"),
            vscode.Uri.joinPath(extensionUri, "client/out/assets/fonts"),
            vscode.Uri.joinPath(extensionUri, "client/out/assets/fonts/katex"),
        ],
    };
}

export class MarkPreview {
    public static currentPanels: { [key: string]: MarkPreview | undefined } = {};

    private readonly _panel: vscode.WebviewPanel;
    private _panelLastViewState: { visible: boolean; active: boolean; viewColumn: vscode.ViewColumn };
    private _panelUri: vscode.Uri;
    private _panelLastContent: string;
    private _panelLastToHtmlResult: string;

    private readonly _context: ExtensionContext;
    private readonly _extensionUri: vscode.Uri;
    private _toHtmlWorkerManager: ToHtmlWorkerManager;
    private _parserWorkerManager: ParserWorkerManager;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(context: ExtensionContext, extensionUri: vscode.Uri, panelId: string, toHtmlWorkerManager: ToHtmlWorkerManager, parserWorkerManager: ParserWorkerManager) {
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

        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId, toHtmlWorkerManager, parserWorkerManager);
    }

    public static revive(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string, toHtmlWorkerManager: ToHtmlWorkerManager, parserWorkerManager: ParserWorkerManager
    ) {
        console.log(path.basename(panelId), "reviving..");
        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId, toHtmlWorkerManager, parserWorkerManager);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string, toHtmlWorkerManager: ToHtmlWorkerManager, parserWorkerManager: ParserWorkerManager
    ) {
        this._panel = panel;
        this._context = context;
        this._extensionUri = extensionUri;
        this._toHtmlWorkerManager = toHtmlWorkerManager;
        this._parserWorkerManager = parserWorkerManager;

        this._panelLastViewState = {
            visible: panel.visible,
            active: panel.active,
            viewColumn: panel.viewColumn
        }

        console.log(path.basename(panelId), "just updated!");
        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(panelId), null, this._disposables);
        this._panel.onDidChangeViewState(
			e => {
				const newState = {
                    visible: e.webviewPanel.visible,
                    active: e.webviewPanel.active,
                    viewColumn: e.webviewPanel.viewColumn
                }

                const wasVisible = this._panelLastViewState.visible
                const isVisible = newState.visible
                
                const lastColumn = this._panelLastViewState.viewColumn
                const currentColumn = newState.viewColumn

                if (wasVisible == false && isVisible == true) {
                    console.log(path.basename(panelId), "just updated!", "due to visibility change");
                    this._update()
                }

                if (lastColumn && lastColumn !== currentColumn) {
                    console.log(path.basename(panelId), "just updated!", "due to column change", lastColumn, currentColumn);
                    this._update()
                }

                this._panelLastViewState = newState
			},
			null,
			this._disposables
		);

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
        console.log(path.basename(panelId), "just disposed!");
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
        if (!this._panelUri) {
            this._panelUri = vscode.window.activeTextEditor.document.uri
        }
        
        vscode.workspace.openTextDocument(this._panelUri).then(document => {
            const webview = this._panel.webview;
            this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, "images/Logo.svg");
            this._panel.title = `${path.basename(document.fileName)} (미리보기)`;
            this._getHtmlForWebview(webview, document);
        })
    }

    private _getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        const vueAppUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "client/out/client/vite-project.mjs"));

        const styleUriList = [];
        for (const css of ["default.css", "github-dark-dimmed.min.css", "github.min.css", "ionicons.min.css", "katex.min.css", "wiki.css"]) {
            styleUriList.push(webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "client/out/client/assets/css/" + css)));
        }

        const stylesheetFlatten = styleUriList
            .map((v) => `<link href="${v}" rel="stylesheet" />`)
            .map((v) => v.toString())
            .join("\n");

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        const text = document.getText();
        if (this._panelLastContent && this._panelLastContent === text) {
            switch (vscode.window.activeColorTheme.kind) {
                case vscode.ColorThemeKind.Dark:
                case vscode.ColorThemeKind.HighContrast:
                    webview.postMessage({ type: "updateTheme", themeKind: "dark" })
                    break;
                default:
                    webview.postMessage({ type: "updateTheme", themeKind: "light" })
                    break;
            }
            webview.postMessage({ type: "updateContent", newContent: this._panelLastToHtmlResult });
            return
        }

        webview.html = `
    <!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="utf-8" />

				<meta http-equiv="Content-Security-Policy" content="default-src 'none';
						style-src ${webview.cspSource} 'unsafe-inline';
						img-src ${webview.cspSource} https://i.ytimg.com data: 'unsafe-inline';
                        font-src ${webview.cspSource} 'unsafe-inline';
                        frame-src https://www.youtube.com https://*.nicovideo.jp;
						script-src 'nonce-${nonce}';">

                <meta http-equiv="Permissions-Policy"
                        content="fullscreen=(self), accelerometer=*, gyroscope=*, encrypted-media=*">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    html.vscode-dark {
                        background-color: #1c1d1f;
                    }

                    body.vscode-dark {
                        color: #e0e0e0
                    }

                    body.vscode-dark a, body.vscode-dark a code {
                        color: #ec9f19;
                        text-decoration: none;
                    }

                    body.vscode-dark p > a {
                        text-decoration: unset;
                    }

                    body.vscode-dark a:hover {
                        color: #bd7f14;
                        text-decoration: underline;
                    }

                    body.vscode-dark code {
                        color: unset;
                        background-color: unset;
                        padding: unset;
                        border-radius: unset;
                    }

                    body.vscode-dark pre code {
                        padding: unset;
                    }

                    body.vscode-dark blockquote {
                        background: unset;
                        border-color: unset;
                    }

                    html.vscode-light {
                        background-color: #fff;
                    }

                    body.vscode-light {
                        color: #212529
                    }

                    body.vscode-light a, body.vscode-light a code {
                        color: #0275d8;
                        text-decoration: none;
                    }

                    body.vscode-light p > a {
                        text-decoration: unset;
                    }

                    body.vscode-light a:hover {
                        color: #0263b8;
                        text-decoration: underline;
                    }

                    body.vscode-light code {
                        color: unset;
                        background-color: unset;
                        padding: unset;
                        border-radius: unset;
                    }

                    body.vscode-light pre code {
                        padding: unset;
                    }

                    body.vscode-light blockquote {
                        background: unset;
                        border-color: unset;
                    }
                </style>
        ${stylesheetFlatten}
				<title>Namucode Preview</title>
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

        switch (vscode.window.activeColorTheme.kind) {
            case vscode.ColorThemeKind.Dark:
            case vscode.ColorThemeKind.HighContrast:
                webview.postMessage({ type: "updateTheme", themeKind: "dark" })
                break;
            default:
                webview.postMessage({ type: "updateTheme", themeKind: "light" })
                break;
        }
        webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; text-align: center; word-break: keep-all;"><h2>렌더링이 진행중입니다! 잠시만 기다려주세요..</h2></div>` });

        (async () => {
            try {
                const { parsed } = await this._parserWorkerManager.remote(text)
                
                const files = await vscode.workspace.findFiles("**/*.namu")  
                const workspaceDocuments = await Promise.all(
                    files.map(async (file) => {
                        const document = await vscode.workspace.openTextDocument(file);
                        const namespace = "문서";
                        const title = path.basename(document.fileName, ".namu");
    
                        const content = document.getText();
    
                        return {
                            namespace,
                            title,
                            content,
                        };
                    })
                );
                const namespace = "문서";
                const title = path.basename(document.fileName, ".namu");
                const { html } = await this._toHtmlWorkerManager.remote(parsed, { document: { namespace, title }, workspaceDocuments })
    
                webview.postMessage({ type: "updateContent", newContent: html });
                this._panelLastContent = text;
                this._panelLastToHtmlResult = html;
            } catch (error) {
                vscode.window.showErrorMessage(`렌더링 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
            }
        })()
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