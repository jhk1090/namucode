import * as path from "path";
import * as vscode from "vscode";
import { promises as fs } from "fs";
import { ExtensionContext } from "vscode";
import imageSize from "image-size";
import { performance } from 'perf_hooks';
import { PARSE_FAILED_HEAD, PARSE_TIMEOUT_HEAD, RENDER_FAILED_HEAD, RENDER_LENGTH_ERROR_HEAD, RENDER_TIMEOUT_HEAD, parse, render } from './worker';

export function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, "dist/media"),
            vscode.Uri.joinPath(extensionUri, "dist/frontend"),
            vscode.Uri.joinPath(extensionUri, "dist/frontend/assets"),
            vscode.Uri.joinPath(extensionUri, "dist/frontend/assets/fonts"),
            vscode.Uri.joinPath(extensionUri, "dist/frontend/assets/fonts/katex"),
        ],
    };
}

interface ICreateOrShowParams {
    context: ExtensionContext;
    extensionUri?: vscode.Uri;
    panelId: string;
    isRenderRetry?: boolean;
    isEditorComment?: boolean;
}

export class MarkPreview {
    public static currentPanels: { [key: string]: MarkPreview | undefined } = {};
    public static currentActivePanelId: string | null = null;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _panelId: string;
    private _panelUri: vscode.Uri;
    private _panelPersist: {
        viewState: { visible: boolean; active: boolean; viewColumn: vscode.ViewColumn };
        content?: string;
        htmlResult?: string;
        categoriesResult?: any[];
    };

    private readonly _context: ExtensionContext;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _isRenderRetry: boolean;
    private _isEditorComment: boolean;
    private _workerTerminator: AbortController;

    public static createOrShow({context, extensionUri, panelId, isRenderRetry, isEditorComment}: ICreateOrShowParams) {
        // If we already have a panel, show it.
        if (MarkPreview.currentPanels[panelId]) {
            if (isRenderRetry) {
                MarkPreview.currentPanels[panelId]._isRenderRetry = true;
                MarkPreview.currentPanels[panelId]._isEditorComment = isEditorComment
                MarkPreview.currentPanels[panelId]._update()
                return;
            }
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
        this._context = context;
        this._extensionUri = extensionUri;

        this._panel = panel;
        this._panelId = panelId;

        this._panelPersist = {
            viewState: {
                visible: panel.visible,
                active: panel.active,
                viewColumn: panel.viewColumn,
            }
        };
        this._isRenderRetry = false;
        this._isEditorComment = false;
        this._workerTerminator = new AbortController()

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

                const wasVisible = this._panelPersist.viewState.visible
                const isVisible = newState.visible
                
                const lastColumn = this._panelPersist.viewState.viewColumn
                const currentColumn = newState.viewColumn

                if (newState.active) {
                    MarkPreview.currentActivePanelId = panelId
                }

                if (wasVisible == false && isVisible == true) {
                    console.log(path.basename(panelId), "just updated!", "due to visibility change");
                    this._update()
                }

                if (lastColumn && lastColumn !== currentColumn) {
                    console.log(path.basename(panelId), "just updated!", "due to column change", lastColumn, currentColumn);
                    this._update()
                }

                this._panelPersist.viewState = newState
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

        const deleteDisposable = vscode.workspace.onDidDeleteFiles((event) => {
            for (const file of event.files) {
                if (panelId.split("namucode-webview-").slice(1).join("namucode-webview-") === file.fsPath) {
                    this._panel.dispose();
                }
            }
        }, null, this._disposables)

        context.subscriptions.push(themeDisposable, saveDisposable, deleteDisposable);
    }

    public dispose(panelId: string) {
        this._workerTerminator.abort()
        
        if (MarkPreview.currentActivePanelId === panelId) {
            MarkPreview.currentActivePanelId = null;
        }

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
        this._workerTerminator.abort();
        this._workerTerminator = new AbortController();

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
        const resetStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/media/reset.css"));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/media/script.js"));

        const vueAppUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/frontend/namucode-client-frontend.mjs"));

        const styleUriList = [];
        for (const css of ["default.css", "github-dark-dimmed.min.css", "github.min.css", "ionicons.min.css", "katex.min.css", "wiki.css", "wikiContent.css", "wikiCategory.css", "button.css"]) {
            styleUriList.push(webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist/frontend/assets/css/" + css)));
        }

        const stylesheetFlatten = styleUriList
            .map((v) => `<link href="${v}" rel="stylesheet" />`)
            .map((v) => v.toString())
            .join("\n");

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        const text = document.getText();
        if (this._panelPersist.content && this._panelPersist.content === text && !this._isRenderRetry) {
            switch (vscode.window.activeColorTheme.kind) {
                case vscode.ColorThemeKind.Dark:
                case vscode.ColorThemeKind.HighContrast:
                    webview.postMessage({ type: "updateTheme", themeKind: "dark" })
                    break;
                default:
                    webview.postMessage({ type: "updateTheme", themeKind: "light" })
                    break;
            }
            webview.postMessage({ type: "updateContent", newContent: this._panelPersist.htmlResult, newCategories: this._panelPersist.categoriesResult });
            return
        }
        this._isRenderRetry = false

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

        const getConfig = () => {
            const workspaceConfig = vscode.workspace.getConfiguration("namucode.preview.parser");
            const maxLength = workspaceConfig.get<number>("maxLength", 5000000);
            const maxRenderingTimeout = workspaceConfig.get<number>("maxRenderingTimeout", 10) * 1000;
            const maxParsingTimeout = workspaceConfig.get<number>("maxParsingTimeout", 7) * 1000;
            const maxParsingDepth = workspaceConfig.get<number>("maxParsingDepth", 30);
            return {
                maxLength,
                maxRenderingTimeout,
                maxParsingTimeout,
                maxParsingDepth,
                extensionPath: this._extensionUri.fsPath,
                isEditorComment: this._isEditorComment
            }
        }

        const registerPersist = (content: string, htmlResult: string, categoriesResult: any[]) => {
            this._panelPersist.content = content;
            this._panelPersist.htmlResult = htmlResult;
            this._panelPersist.categoriesResult = categoriesResult;
        }

        const runParsing = async () => {
            const startTime = performance.now();
            const config = getConfig()

            const { result, error, errorCode, errorMessage } = await parse(this._context, { text, config, signal: this._workerTerminator.signal })
            let html = ""

            if (error) {
                if (errorCode === "aborted") {
                    return { error: true, errorCode }
                } else if (errorCode === "parse_failed") {
                    html = `<div style="width: 100%; word-break: keep-all;"><h2>${PARSE_FAILED_HEAD}</h2><h3>왜 이런 문제가 발생했나요?</h3><p>파일의 텍스트를 파싱하는 과정에서 오류가 발생했기 때문입니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>아래 에러 코드를 <a href="https://github.com/jhk1090/namucode/issues">나무코드 이슈트래커</a>에 제보해주세요.<br /><br /><pre><code>${escapeHTML(errorMessage)}</code></pre></p></div>`
                } else {
                    html = `<div style="width: 100%; word-break: keep-all;"><h2>${PARSE_TIMEOUT_HEAD}</h2><h3>왜 이런 문제가 발생했나요?</h3><p>설정한 파싱 대기 시간을 초과했기 때문입니다. 내용이 너무 크거나, 설정에서 파싱 대기 시간을 너무 짧게 설정했을 수 있습니다.<br />또는 최초 실행했을 때 캐싱이 되지 않아 시간이 오래 걸릴 수도 있습니다. (이는 몇 번 재실행하면 해결됩니다.)</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 파싱 대기 시간(Max Parsing Timeout)을 늘려보세요.</p></div>`
                }

                registerPersist(text, html, [])
                return { error: true, errorCode, result, html, duration: null }
            }

            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2)

            html = `<div style="width: 100%; word-break: keep-all;"><h2>미리보기를 준비하는 중입니다.</h2><h3>작업 환경 리소스 불러오는 중.. (2/3)</h3><h3>파싱 중.. (완료! ${duration}ms)</h3></div>`

            return { error: false, result, html, duration };
        }

        const loadWorkspaceResources = async (currentFolder: vscode.WorkspaceFolder, parsingDuration: string) => {
            const workspaceConfig = vscode.workspace.getConfiguration("namucode.preview.parser");
            const workspaceReference = workspaceConfig.get<boolean>("workspaceReference", true);

            const startTime = performance.now();

            let workspaceDocuments = []
            if (workspaceReference && currentFolder) {
                const namuFiles = await vscode.workspace.findFiles("**/*.namu")  

                workspaceDocuments.push(...await Promise.all(
                    namuFiles.map(async (file) => {
                        const document = await vscode.workspace.openTextDocument(file);
                        const { namespace, title } = await getNamespaceAndTitle(currentFolder.uri.fsPath, file.fsPath)

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
                            let title = path.relative(currentFolder.uri.fsPath, file.fsPath)
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

            const endTime = performance.now();
            const duration = (endTime - startTime).toFixed(2)

            webview.postMessage({ type: "updateContent", newContent: `<div style="width: 100%; word-break: keep-all;"><h2>미리보기를 준비하는 중입니다.</h2><h3>렌더링 중.. (3/3)</h3><h3>작업 환경 리소스 불러오는 중.. (완료! ${duration}ms)</h3><h3>파싱 중.. (완료! ${parsingDuration}ms)</h3></div>`, newCategories: [] });

            return workspaceDocuments
        }

        const runRendering = async (currentFolder: vscode.WorkspaceFolder, parsedResult, workspaceDocuments) => {
            const config = getConfig()
            const { namespace, title } = await getNamespaceAndTitle(currentFolder ? currentFolder.uri.fsPath : path.dirname(document.uri.fsPath), document.uri.fsPath)
            const includeData = this._context.workspaceState.get("includeParameterEditorInput") as { [key: string]: string } ?? null

            let { html, categories, error, errorCode, errorMessage } = await render(this._context, { parsedResult,  document: { namespace, title }, workspaceDocuments, config, includeData, signal: this._workerTerminator.signal })

            if (error) {
                if (errorCode === "aborted") {
                    return
                } else if (errorCode === "render_failed") {
                    html = `<div style="width: 100%; word-break: keep-all;"><h2>${RENDER_FAILED_HEAD}</h2><h3>왜 이런 문제가 발생했나요?</h3><p>파싱된 데이터를 HTML 코드로 바꾸는 렌더링을 하는 과정에서 오류가 발생했기 때문입니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>아래 에러 코드를 <a href="https://github.com/jhk1090/namucode/issues">나무코드 이슈트래커</a>에 제보해주세요.<br /><br /><pre><code>${escapeHTML(errorMessage)}</code></pre></p></div>`
                } else if (errorCode === "render_timeout") {
                    html = `<div style="width: 100%; word-break: keep-all;"><h2>${RENDER_TIMEOUT_HEAD}</h2><h3>왜 이런 문제가 발생했나요?</h3><p>설정한 렌더링 대기 시간을 초과했기 때문입니다. 내용이 너무 크거나, 설정에서 렌더링 대기 시간을 너무 짧게 설정했을 수 있습니다.<br />또는 최초 실행했을 때 캐싱이 되지 않아 시간이 오래 걸릴 수도 있습니다. (이는 몇 번 재실행하면 해결됩니다.)</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 렌더링 대기 시간(Max Rendering Timeout)을 늘려보세요.</p></div>`
                } else {
                    html = `<div style="width: 100%; word-break: keep-all;"><h2>${RENDER_LENGTH_ERROR_HEAD}</h2><h3>왜 이런 문제가 발생했나요?</h3><p>렌더링한 HTML 결과값이 표시하기에 너무 크다면 이런 문제가 발생합니다.</p><h3>어떻게 해결할 수 있나요?</h3><p>내용이 큰 경우, 이 탭의 위 네비게이션 바의 <b>미리보기 설정</b> 버튼을 누르고 설정을 열어 문서 최대 길이(Max Length)를 늘려보세요.</p></div>`
                }
            }

            webview.postMessage({ type: "updateContent", newContent: html, newCategories: categories });
            registerPersist(text, html, categories)
        }

        (async () => {
            try {
                const { error, errorCode, result: parsedResult, html, duration: parsingDuration } = await runParsing();
                if (!errorCode || errorCode !== "aborted") {
                    webview.postMessage({ type: "updateContent", newContent: html, newCategories: [] });
                }
                if (error) return;

                const currentFolder = vscode.workspace.getWorkspaceFolder(this._panelUri)
                const workspaceDocuments = await loadWorkspaceResources(currentFolder, parsingDuration);

                runRendering(currentFolder, parsedResult, workspaceDocuments)
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
            this._isEditorComment = false
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
async function getNamespaceAndTitle(parentPath: string, childPath: string) {
    let relativePath = path.relative(parentPath, childPath)
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

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}