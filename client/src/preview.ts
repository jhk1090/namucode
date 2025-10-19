import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { parserRemote, toHtmlRemote } from './worker';

export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, "client/media"),
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
    private readonly _panelId: string;
    private _panelLastViewState: { visible: boolean; active: boolean; viewColumn: vscode.ViewColumn };
    private _panelUri: vscode.Uri;
    private _panelLastContent: string;
    private _panelLastHtmlResult: string;
    private _panelLastCategoriesResult: any[];

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

    public static revive(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string
    ) {
        console.log(path.basename(panelId), "reviving..");
        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string
    ) {
        this._panel = panel;
        this._context = context;
        this._extensionUri = extensionUri;
        this._panelId = panelId;

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
        const resetStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "client/media/reset.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "client/media/script.js"));

        const vueAppUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "client/out/client/vite-project.mjs"));

        const styleUriList = [];
        for (const css of ["default.css", "github-dark-dimmed.min.css", "github.min.css", "ionicons.min.css", "katex.min.css", "wiki.css", "wikiContent.css", "wikiCategory.css", "button.css"]) {
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
            webview.postMessage({ type: "updateContent", newContent: this._panelLastHtmlResult, newCategories: this._panelLastCategoriesResult });
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
                <link href="${resetStyleUri}" rel="stylesheet" />
                ${stylesheetFlatten}
				<title>Namucode Preview</title>
		</head>
		<body>
				<div id="app"></div>
				<script type="text/javascript" src="${vueAppUri}" nonce="${nonce}"></script>
				<script type="text/javascript" src="${scriptUri}" nonce="${nonce}"></script>
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
        webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; text-align: center; word-break: keep-all;"><h2>렌더링이 진행중입니다! 잠시만 기다려주세요..</h2></div>`, newCategories: [] });

        (async () => {
            try {
                const { parsed } = await parserRemote(this._context, text)
                
                const workspaceConfig = vscode.workspace.getConfiguration("namucode.preview.parser");
                const workspaceConfigWorkspaceReference = workspaceConfig.get<boolean>("workspaceReference", true);
                
                const parentUri = vscode.workspace.getWorkspaceFolder(this._panelUri).uri

                let workspaceDocuments = []
                if (workspaceConfigWorkspaceReference) {
                    const files = await vscode.workspace.findFiles("**/*.namu")  
    
                    workspaceDocuments = await Promise.all(
                        files.map(async (file) => {
                            const document = await vscode.workspace.openTextDocument(file);
                            const { namespace, title } = await getNamespaceAndTitle(parentUri, file)
    
                            const content = document.getText();
        
                            return {
                                namespace,
                                title,
                                content,
                            };
                        })
                    );
                }

                const { namespace, title } = await getNamespaceAndTitle(parentUri, document.uri)
                const workspaceConfigMaxLength = workspaceConfig.get<number>("maxLength", 5000000);
                const workspaceConfigMaxTimeout = workspaceConfig.get<number>("maxTimeout", 10);
                const config = {
                    maxLength: workspaceConfigMaxLength,
                    maxTimeout: workspaceConfigMaxTimeout * 1000
                }

                const { html, categories } = await toHtmlRemote(this._context, parsed, { document: { namespace, title }, workspaceDocuments, config })
    
                webview.postMessage({ type: "updateContent", newContent: html, newCategories: categories });
                this._panelLastContent = text;
                this._panelLastHtmlResult = html;
                this._panelLastCategoriesResult = categories;
            } catch (error) {
                this.dispose(this._panelId);
                const errorMessage = await vscode.window.showErrorMessage(`미리보기 렌더링 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, "제보하기", "재시도");
                if (errorMessage === "제보하기") {
                    vscode.env.openExternal(vscode.Uri.parse("https://github.com/jhk1090/namucode/issues"));
                }
                if (errorMessage === "재시도") {
                    vscode.commands.executeCommand("namucode.preview")
                }
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

const allowedNamespace = ["분류", "틀", "사용자"];
async function getNamespaceAndTitle(parentUri: vscode.Uri, childUri: vscode.Uri) {
    let relativePath = path.relative(parentUri.fsPath, childUri.fsPath)
    let namespace = "문서";

    const extension = ".namu"
    relativePath = relativePath.replace(/\\/g, "/")

    let title = relativePath.slice(0, -extension.length)
    let namespaceSplitted = title.split(".")
    let target = namespaceSplitted.at(-1)
    if (allowedNamespace.includes(target)) {
        // 분류는 namespace = 분류, title = 문서명
        if (target === "분류") {
            namespace = namespaceSplitted.at(-1)
            namespaceSplitted.splice(-1, 1)
            title = namespaceSplitted.join(".")
        // 틀은 namespace = 문서, title = 틀
        } else {
            let namespaceTmp = target
            namespaceSplitted.splice(-1, 1)
            title = namespaceTmp + ":" + namespaceSplitted.join(".")
        }
    }

    return { namespace, title }
}