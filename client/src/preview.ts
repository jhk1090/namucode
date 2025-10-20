import * as path from "path";
import * as vscode from "vscode";
import { promises as fs } from "fs";
import { ExtensionContext } from "vscode";
import { parserRemote, toHtmlRemote } from './worker';
import imageSize from "image-size";
import { performance } from 'perf_hooks';

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
                if (panelId.split("namucode-webview-").slice(1).join("namucode-webview-") === document.fileName) {
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
        webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; word-break: keep-all;"><h2>미리보기를 준비하는 중입니다.</h2><h3>파싱 중.. (1/3)</h3></div>`, newCategories: [] });
        (async () => {
            try {
                const parsingStart = performance.now();

                const workspaceConfig = vscode.workspace.getConfiguration("namucode.preview.parser");

                const maxLength = workspaceConfig.get<number>("maxLength", 5000000);
                const maxRenderingTimeout = workspaceConfig.get<number>("maxRenderingTimeout", 10) * 1000;
                const maxParsingTimeout = workspaceConfig.get<number>("maxParsingTimeout", 7) * 1000;
                const config = {
                    maxLength,
                    maxRenderingTimeout,
                    maxParsingTimeout
                }

                let { parsed, hasError, html: parserHtml, errorCode: parserErrorCode, errorMessage: parserErrorMessage } = await parserRemote(this._context, text, config)
                if (hasError) {
                    if (parserErrorCode === "parsing_failed") {
                        parserHtml = `<div style="width: 100%; word-break: keep-all;">${parserHtml}<h3>왜 이런 문제가 발생했나요?</h3><p>파일의 텍스트를 파싱하는 과정에서 오류가 발생했기 때문입니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>아래 에러 코드를 <a href="https://github.com/jhk1090/namucode/issues">나무코드 이슈트래커</a>에 제보해주세요.<br /><br /><code style="color: red">${parserErrorMessage}</code></p></div>`
                    } else {
                        parserHtml = `<div style="width: 100%; word-break: keep-all;">${parserHtml}<h3>왜 이런 문제가 발생했나요?</h3><p>설정한 파싱 대기 시간을 초과했기 때문입니다. 내용이 너무 크거나, 설정에서 파싱 대기 시간을 너무 짧게 설정했을 수 있습니다.<br />또는 최초 실행했을 때 캐싱이 되지 않아 시간이 오래 걸릴 수도 있습니다. (이는 몇 번 재실행하면 해결됩니다.)</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 파싱 대기 시간(Max Parsing Timeout)을 늘려보세요.</p></div>`
                    }

                    webview.postMessage({ type: "updateContent", newContent: parserHtml, newCategories: [] });
                    this._panelLastContent = text;
                    this._panelLastHtmlResult = parserHtml;
                    this._panelLastCategoriesResult = [];
                    return
                }

                const parsingEnd = performance.now();
                const parsingDuration = (parsingEnd - parsingStart).toFixed(2)
                webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; word-break: keep-all;"><h2>미리보기를 준비하는 중입니다.</h2><h3>작업 환경 리소스 불러오는 중.. (2/3)</h3><h3>파싱 중.. (완료! ${parsingDuration}ms)</h3></div>`, newCategories: [] });

                const workspaceReference = workspaceConfig.get<boolean>("workspaceReference", true);
                
                const parentUri = vscode.workspace.getWorkspaceFolder(this._panelUri).uri

                const loadingWorkspaceStart = performance.now();

                let workspaceDocuments = []
                if (workspaceReference) {
                    const namuFiles = await vscode.workspace.findFiles("**/*.namu")  
    
                    workspaceDocuments.push(...await Promise.all(
                        namuFiles.map(async (file) => {
                            const document = await vscode.workspace.openTextDocument(file);
                            const { namespace, title } = await getNamespaceAndTitle(parentUri, file)
    
                            const content = document.getText();
        
                            return {
                                namespace,
                                title,
                                content,
                            };
                        })
                    ))

                    const mediaFiles = await vscode.workspace.findFiles("{**/*.png,**/*.jpg,**/*.jpeg,**/*.svg,**/*.gif,**/*.webp}")
                    const mappedMediaFiles = await Promise.all(
                        mediaFiles.map(async (file) => {
                            try {
                                let title = path.relative(parentUri.fsPath, file.fsPath)
                                let namespace = "문서";

                                title = title.replace(/\\/g, "/")
                                const fileKey = await imageUriToDataUri(file)
                                const { fileHeight, fileWidth, fileSize } = await getImageInfo(file)

                                return {
                                    namespace,
                                    title: "파일:" + title,
                                    content: {
                                        fileKey,
                                        fileWidth,
                                        fileHeight,
                                        fileSize
                                    }
                                }
                            } catch (err) {
                                console.error(err.message)                     
                                return null;
                            }
                        })
                    )

                    workspaceDocuments.push(...mappedMediaFiles.filter(v => v !== null))
                }

                const loadingWorkspaceEnd = performance.now();
                const loadingWorkspaceDuration = (loadingWorkspaceEnd - loadingWorkspaceStart).toFixed(2)

                webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; word-break: keep-all;"><h2>미리보기를 준비하는 중입니다.</h2><h3>렌더링 중.. (3/3)</h3><h3>작업 환경 리소스 불러오는 중.. (완료! ${loadingWorkspaceDuration}ms)</h3><h3>파싱 중.. (완료! ${parsingDuration}ms)</h3></div>`, newCategories: [] });

                const { namespace, title } = await getNamespaceAndTitle(parentUri, document.uri)
                let { html, categories, hasError: hasErrorToHtml, errorCode, errorMessage } = await toHtmlRemote(this._context, parsed, { document: { namespace, title }, workspaceDocuments, config })

                if (hasErrorToHtml) {
                    if (errorCode === "render_failed") {
                        html = `<div style="width: 100%; word-break: keep-all;">${html}<h3>왜 이런 문제가 발생했나요?</h3><p>파싱된 데이터를 HTML 코드로 바꾸는 렌더링을 하는 과정에서 오류가 발생했기 때문입니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>아래 에러 코드를 <a href="https://github.com/jhk1090/namucode/issues">나무코드 이슈트래커</a>에 제보해주세요.<br /><br /><code style="color: red">${errorMessage}</code></p></div>`
                    } else if (errorCode === "render_timeout") {
                        html = `<div style="width: 100%; word-break: keep-all;">${html}<h3>왜 이런 문제가 발생했나요?</h3><p>설정한 렌더링 대기 시간을 초과했기 때문입니다. 내용이 너무 크거나, 설정에서 렌더링 대기 시간을 너무 짧게 설정했을 수 있습니다.<br />또는 최초 실행했을 때 캐싱이 되지 않아 시간이 오래 걸릴 수도 있습니다. (이는 몇 번 재실행하면 해결됩니다.)</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 렌더링 대기 시간(Max Rendering Timeout)을 늘려보세요.</p></div>`
                    } else {
                        html = `<div style="width: 100%; word-break: keep-all;">${html}<h3>왜 이런 문제가 발생했나요?</h3><p>렌더링한 HTML 결과값이 표시하기에 너무 크다면 이런 문제가 발생합니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 문서 최대 길이(Max Length)를 늘려보세요.</p></div>`
                    }
                }

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

function getMimeType(uri: vscode.Uri): string {
    const extension = path.extname(uri.fsPath).toLowerCase();
    switch (extension) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream'; // 알 수 없는 타입
    }
}

async function imageUriToDataUri(imageUri: vscode.Uri): Promise<string> {
    const filePath = imageUri.fsPath;
    const mimeType = getMimeType(imageUri);

    if (mimeType === 'application/octet-stream') {
        throw new Error('Unsupported image file type.');
    }

    return new Promise(async (resolve, reject) => {
        try {
            const data = await fs.readFile(filePath);
            const base64Data = data.toString('base64');
            const dataUri = `data:${mimeType};base64,${base64Data}`;
            
            resolve(dataUri);
        } catch (err) {
            reject(new Error(`Failed to read file: ${err.message}`));
        }
    });
}

async function getImageInfo(imageUri: vscode.Uri) {
    const path = imageUri.fsPath;
    
    const stats = await fs.stat(path);
    const buffer = await fs.readFile(path);
    const { width, height } = imageSize(buffer);

    return {
        fileWidth: width,
        fileHeight: height,
        fileSize: stats.size,
    };
}