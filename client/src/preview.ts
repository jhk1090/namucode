import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { parser } from "../media/parser";
import { spawn, ChildProcess } from "child_process";
import * as crypto from "crypto";
import { ParsedData, ToHtmlOptions, IWorkerMessage, IWorkerResponse, IWorkerResponseSuccess } from "./types";

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
    private readonly _workerManager: ToHtmlWorkerManager;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(context: ExtensionContext, extensionUri: vscode.Uri, panelId: string, workerManager: ToHtmlWorkerManager) {
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

        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId, workerManager);
    }

    public static revive(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string,
        workerManager: ToHtmlWorkerManager
    ) {
        console.log(path.basename(panelId), "reviving..");
        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId, workerManager);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string,
        workerManager: ToHtmlWorkerManager
    ) {
        this._panel = panel;
        this._context = context;
        this._extensionUri = extensionUri;
        this._workerManager = workerManager;

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
        console.log(this._disposables);
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
        const parsed = parser(text);
        this._workerManager
            .toHtmlRemote(parsed, { namespace: "문서", title: "Document" })
            .then((value) => {
                webview.postMessage({ type: "updateContent", newContent: value.html });
                this._panelLastContent = text
                this._panelLastToHtmlResult = value.html
            })
            .catch((error) => vscode.window.showErrorMessage(`HTML 렌더링 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`));
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

interface PendingRequest {
    resolve: (value: IWorkerResponseSuccess) => void;
    reject: (reason?: any) => void;
}

export class ToHtmlWorkerManager {
    private worker: ChildProcess | null = null;
    private pendingRequests = new Map<string, PendingRequest>();
    private readonly workerPath: string;

    constructor(context: ExtensionContext) {
        // ⚠️ TypeScript를 사용해도 Node.js 런타임에서 실행될 때는
        // 컴파일된 JavaScript 파일을 지정해야 합니다.
        // 예를 들어, toHtmlWorker.ts가 toHtmlWorker.js로 컴파일된다고 가정합니다.
        this.workerPath = path.join(context.extensionPath, "client/media/parser", "index.js");
        this.initializeWorker(context);
    }

    private initializeWorker(context: ExtensionContext): void {
        const config = vscode.workspace.getConfiguration("namucode");
        const nodePath = config.get<string>("nodePath", "node");

        this.worker = spawn(nodePath, [this.workerPath], {
    // 💥 표준 Node.js 경로를 사용합니다.
            stdio: ['ipc', 'pipe', 'pipe'], // IPC와 pipe를 모두 사용
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined,
                ATOM_SHELL_INTERNAL_RUN_AS_NODE: undefined
            },
            windowsHide: true
        });

        // Worker에서 메시지 수신 핸들러 설정
        this.worker.on("message", (response: IWorkerResponse) => {
            const request = this.pendingRequests.get(response.id);
            if (!request) return;

            if (response.status === "success") {
                request.resolve(response);
            } else {
                request.reject(new Error(response.message));
            }
            this.pendingRequests.delete(response.id);
        });

        // Worker 종료 이벤트 처리
        this.worker.on("exit", (code, signal) => {
            vscode.window.showWarningMessage(`ToHtml Worker process terminated. Code: ${code}, Signal: ${signal}`);
            this.worker = null;
            // 종료된 Worker로 인해 대기 중인 모든 프로미스를 거부
            this.pendingRequests.forEach((req) => req.reject(new Error("ToHtml worker process unexpectedly terminated.")));
            this.pendingRequests.clear();
        });

        this.worker.on("error", (err) => {
            vscode.window.showErrorMessage(`ToHtml Worker experienced an error: ${err.message}`);
            this.worker = null;
        });
    }

    /**
     * toHtml 함수를 Child Process에서 실행하고 Promise로 결과를 반환합니다.
     */
    public toHtmlRemote(parsed: ParsedData, options: ToHtmlOptions): Promise<IWorkerResponseSuccess> {
        if (!this.worker) {
            return Promise.reject(new Error("ToHtml Worker not active. Please reload the window."));
        }

        return new Promise((resolve, reject) => {
            const id = crypto.randomBytes(16).toString("hex");

            this.pendingRequests.set(id, { resolve, reject });

            const message: IWorkerMessage = {
                id: id,
                command: "toHtml",
                parsed: parsed,
                options: options,
            };

            // Worker Process로 메시지 전송
            this.worker!.send(message);

            // ⚠️ 여기서 타입 단언 `worker!.send`를 사용하거나,
            // `if (this.worker)` 체크 후 `this.worker.send(message)`를 호출해야 합니다.
        });
    }

    /**
     * 확장 프로그램이 비활성화될 때 워커를 종료합니다.
     */
    public dispose(): void {
        if (this.worker) {
            this.worker.kill("SIGTERM"); // 우아하게 종료 시도
            this.worker = null;
        }
    }
}
