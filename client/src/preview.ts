import * as path from "path";
import * as vscode from "vscode";
import { promises as fs } from "fs";
import { ExtensionContext } from "vscode";
import imageSize from "image-size";
import { performance } from 'perf_hooks';
import { DocumentSymbolProvider } from './providers/DocumentSymbolProvider';
const renderer = require("../media/parser/core/toHtmlWorker.js")

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

    private readonly panel: vscode.WebviewPanel;
    private readonly panelId: string;
    private panelUri: vscode.Uri;
    private panelViewState: { visible: boolean; active: boolean; viewColumn: vscode.ViewColumn };

    private readonly context: ExtensionContext;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private isEditorComment: boolean;
    private workerTerminator: AbortController;

    public static createOrShow({context, extensionUri, panelId, isRenderRetry, isEditorComment}: ICreateOrShowParams) {
        // If we already have a panel, show it.
        if (MarkPreview.currentPanels[panelId]) {
            if (isRenderRetry) {
                MarkPreview.currentPanels[panelId].isEditorComment = isEditorComment
                MarkPreview.currentPanels[panelId]._update()
                return;
            }
            MarkPreview.currentPanels[panelId].panel.reveal();
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
        // console.log(path.basename(panelId), "reviving..");
        MarkPreview.currentPanels[panelId] = new MarkPreview(panel, context, extensionUri, panelId);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        context: ExtensionContext,
        extensionUri: vscode.Uri,
        panelId: string
    ) {
        this.context = context;
        this.extensionUri = extensionUri;

        this.panel = panel;
        this.panelId = panelId;

        this.panelViewState = {
            visible: panel.visible,
            active: panel.active,
            viewColumn: panel.viewColumn,
        };
        this.isEditorComment = false;
        this.workerTerminator = new AbortController()

        // console.log(path.basename(panelId), "just updated!");
        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this.panel.onDidDispose(() => this.dispose(panelId), null, this.disposables);
        this.panel.onDidChangeViewState(
			e => {
				const newState = {
                    visible: e.webviewPanel.visible,
                    active: e.webviewPanel.active,
                    viewColumn: e.webviewPanel.viewColumn
                }

                const wasVisible = this.panelViewState.visible
                const isVisible = newState.visible
                
                const lastColumn = this.panelViewState.viewColumn
                const currentColumn = newState.viewColumn

                if (newState.active) {
                    MarkPreview.currentActivePanelId = panelId
                }

                if (wasVisible == false && isVisible == true) {
                    // console.log(path.basename(panelId), "just updated!", "due to visibility change");
                    this._update()
                }

                if (lastColumn && lastColumn !== currentColumn) {
                    // console.log(path.basename(panelId), "just updated!", "due to column change", lastColumn, currentColumn);
                    this._update()
                }

                this.panelViewState = newState
			},
			null,
			this.disposables
		);

        const themeDisposable = vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (event.affectsConfiguration("workbench.colorTheme")) {
                    // console.log(path.basename(panelId), "just updated!", "in theme state");
                    this._update();
                }
            },
            null,
            this.disposables
        );

        const saveDisposable = vscode.workspace.onDidSaveTextDocument(
            (document) => {
                if (panelId.split("namucode-webview-").slice(1).join("namucode-webview-") === document.fileName) {
                    // console.log(path.basename(panelId), "just updated!", "in save state");
                    this._update();
                }
            },
            null,
            this.disposables
        );

        const deleteDisposable = vscode.workspace.onDidDeleteFiles((event) => {
            for (const file of event.files) {
                if (panelId.split("namucode-webview-").slice(1).join("namucode-webview-") === file.fsPath) {
                    this.panel.dispose();
                }
            }
        }, null, this.disposables)

        context.subscriptions.push(themeDisposable, saveDisposable, deleteDisposable);
    }

    public dispose(panelId: string) {
        this.workerTerminator.abort()
        
        if (MarkPreview.currentActivePanelId === panelId) {
            MarkPreview.currentActivePanelId = null;
        }

        MarkPreview.currentPanels[panelId] = undefined;
        // console.log(path.basename(panelId), "just disposed!");
        // Clean up our resources
        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this.workerTerminator.abort();
        this.workerTerminator = new AbortController();

        if (!this.panelUri) {
            this.panelUri = vscode.window.activeTextEditor.document.uri
        }
        
        vscode.workspace.openTextDocument(this.panelUri).then(document => {
            const webview = this.panel.webview;
            this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, "images/Logo.svg");
            this.panel.title = `${path.basename(document.fileName)} (미리보기)`;
            this._getHtmlForWebview(webview, document);
        })
    }

    private _getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        if (webview.html === "") {
            const resetStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist/media/reset.css"));
            const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist/media/script.js"));

            const vueAppUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist/frontend/namucode-client-frontend.mjs"));

            const styleUriList = [];
            for (const css of ["default.css", "github-dark-dimmed.min.css", "github.min.css", "ionicons.min.css", "katex.min.css", "wiki.css", "wikiContent.css", "wikiCategory.css", /* "button.css" */]) {
                styleUriList.push(webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "dist/frontend/assets/css/" + css)));
            }

            const stylesheetFlatten = styleUriList
                .map((v) => `<link href="${v}" rel="stylesheet" />`)
                .map((v) => v.toString())
                .join("\n");

            // Use a nonce to only allow specific scripts to be run
            const nonce = getNonce();

            webview.html = `
        <!DOCTYPE html>
            <html lang="en">
            <head>
                    <meta charset="utf-8" />
    
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none';
                            style-src ${webview.cspSource} 'unsafe-inline';
                            img-src ${webview.cspSource} https://i.ytimg.com data: 'unsafe-inline';
                            font-src ${webview.cspSource} 'unsafe-inline';
                            frame-src https://www.youtube.com https://*.nicovideo.jp https://tv.naver.com;
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
            webview.postMessage({ type: "updateContent", newContent: "<h2>미리보기를 준비중입니다. 잠시만 기다려주세요...</h2>" });
        }

        switch (vscode.window.activeColorTheme.kind) {
            case vscode.ColorThemeKind.Dark:
            case vscode.ColorThemeKind.HighContrast:
                webview.postMessage({ type: "updateTheme", themeKind: "dark" })
                break;
            default:
                webview.postMessage({ type: "updateTheme", themeKind: "light" })
                break;
        }

        const getConfig = () => {
            const rootConfig = vscode.workspace.getConfiguration("namucode");
            const maxLength = rootConfig.get<number>("preview.maxLength", 5000000);
            const maxRenderingTimeout = rootConfig.get<number>("preview.maxRenderingTimeout", 10) * 1000;
            const maxParsingDepth = rootConfig.get<number>("parser.maxParsingDepth", 30);
            const maxParsingCharacter = rootConfig.get<number>("parser.maxParsingCharacter", 1500000);
            const internalLinkDomain = rootConfig.get<string>("preview.internalLinkDomain", "https://namu.wiki")
            return {
                maxLength,
                maxRenderingTimeout,
                maxParsingDepth,
                maxParsingCharacter,
                internalLinkDomain,
                extensionPath: this.extensionUri.fsPath,
                isEditorComment: this.isEditorComment
            }
        }

        const runParsing = async () => {
            const config = getConfig()

            const result = await DocumentSymbolProvider.createParserPromise(document, { editorComment: config.isEditorComment, maxParsingDepth: config.maxParsingDepth, maxCharacter: config.maxParsingCharacter })

            return result;
        }

        const loadWorkspaceResources = async (currentFolder: vscode.WorkspaceFolder) => {
            const rootConfig = vscode.workspace.getConfiguration("namucode");
            const workspaceReference = rootConfig.get<boolean>("preview.workspaceReference", true);

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
            // console.log(`[Workspace Resource] ▶️ ${duration}ms 걸림`)

            workspaceDocuments.sort((a, b) => a.namespace.localeCompare(b.namespace))
            workspaceDocuments.sort((a, b) => a.title.localeCompare(b.title))
            return workspaceDocuments
        }

        const runRendering = async (currentFolder: vscode.WorkspaceFolder, parsedResult, workspaceDocuments) => {
            const config = getConfig()
            const { namespace, title } = await getNamespaceAndTitle(currentFolder ? currentFolder.uri.fsPath : path.dirname(document.uri.fsPath), document.uri.fsPath)
            let includeData = {...this.context.workspaceState.get("includeParameterEditorInput") as { [key: string]: string } ?? {}}
            const unescape = s => s.replace(/\\(.)/g, "$1");
            for (const [key, value] of Object.entries(includeData)) {
                includeData[key] = unescape(value)
            }

            const timeout = setTimeout(() => {
                // console.log("Termination")
                this.workerTerminator.abort()
            }, config.maxRenderingTimeout)
            
            let { html, categories, error, errorCode, errorMessage } = await RendererProvider.createRendererPromise(document, { parsedResult: structuredClone(parsedResult),  document: { namespace, title }, workspaceDocuments, config, includeData, signal: this.workerTerminator.signal })
            clearTimeout(timeout)

            if (error) {
                this.dispose(this.panelId);
                RendererProvider.removeRendererPromise(document)
                const errorQuestion = await vscode.window.showErrorMessage(
                    errorCode === "aborted" ? "렌더링에 실패했습니다: 렌더링이 중단되었습니다.\n이 문제가 발생하는 원인 중에는 시간 초과가 있을 수 있습니다. 설정을 누른 후, 파싱 최대 대기 시간 / 렌더링 최대 대기 시간을 적절히 조정해 시간 초과 문제를 해결할 수 있습니다. 문제를 해결하지 못했다면 제보하기를 누른 후 이슈트래커로 제보해주세요." : errorCode === "render_too_long" ? "렌더링에 실패했습니다: 문서가 너무 깁니다. 설정에서 최대 글자수를 늘려 이 문제를 해결할 수 있습니다. 문제를 해결하지 못했다면 제보하기를 누른 후 이슈트래커로 제보해주세요." : `렌더링에 실패했습니다: 예기치 않은 오류가 발생했습니다.\n${errorMessage}\n이 버그가 계속해서 재현된다면 제보하기를 누른 후 이슈트래커로 제보해주세요.`, "설정", "제보하기")
                if (errorQuestion === "설정") {
                    vscode.commands.executeCommand('workbench.action.openSettings', "@ext:jhk1090.namucode");
                }
                if (errorQuestion === "제보하기") {
                    vscode.env.openExternal(vscode.Uri.parse("https://github.com/jhk1090/namucode/issues"));
                }
            }

            webview.postMessage({ type: "updateContent", newContent: html, newCategories: categories, newUserbox: { parameterAlert: includeData } });
        }

        (async () => {
            try {
                const parsedResult = await runParsing();
                if (parsedResult.errorCode) {
                    this.dispose(this.panelId);
                    const msg = await vscode.window.showErrorMessage(`파싱 허용 문서 최대 글자 수인 ${getConfig().maxParsingCharacter}자가 넘어가 미리보기 기능을 사용할 수 없습니다. 글자 수를 줄이거나 설정에서 "파싱 허용 문서 최대 글자 수"를 늘릴 수 있습니다.`, "설정")
                    if (msg === "설정") {
                        vscode.commands.executeCommand('workbench.action.openSettings', "@ext:jhk1090.namucode");
                    }
                    return
                }

                const currentFolder = vscode.workspace.getWorkspaceFolder(this.panelUri)
                const workspaceDocuments = await loadWorkspaceResources(currentFolder);

                runRendering(currentFolder, parsedResult, workspaceDocuments)
            } catch (error) {
                this.dispose(this.panelId);
                const errorMessage = await vscode.window.showErrorMessage(`미리보기 렌더링 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`, "제보하기", "재시도");
                if (errorMessage === "제보하기") {
                    vscode.env.openExternal(vscode.Uri.parse("https://github.com/jhk1090/namucode/issues"));
                }
                if (errorMessage === "재시도") {
                    vscode.commands.executeCommand("namucode.preview")
                }
            }
            this.isEditorComment = false
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

interface IRendererParams {
    parsedResult: any;
    document: { namespace: string; title: string };
    workspaceDocuments: any[];
    config: { maxParsingDepth: number; extensionPath: string; isEditorComment: boolean; maxLength: number; maxRenderingTimeout: number; internalLinkDomain: string; };
    includeData: { [key: string]: string };
    signal: AbortSignal;
}

interface IRendererReturn {
    html: string;
    categories: any[];
    error: boolean;
    errorCode?: "render_timeout" | "render_failed" | "render_too_long" | "aborted";
    errorMessage?: string;
}

export class RendererProvider {
    static cache = new Map<string, { version: number; params: IRendererParams; promise: Promise<any> }>();

    static async createRendererPromise(document: vscode.TextDocument, params: IRendererParams): Promise<IRendererReturn> {
        const key = document.uri.toString();
        const version = document.version;

        const cached = RendererProvider.cache.get(key);
        if (
            cached &&
            cached.version === version &&
            deepEqual(params.workspaceDocuments, cached.params.workspaceDocuments) &&
            params.config.extensionPath === cached.params.config.extensionPath &&
            JSON.stringify(params.includeData) === JSON.stringify(cached.params.includeData) &&
            params.config.maxParsingDepth === cached.params.config.maxParsingDepth &&
            params.config.isEditorComment === cached.params.config.isEditorComment &&
            params.config.maxLength === cached.params.config.maxLength &&
            params.config.internalLinkDomain === cached.params.config.internalLinkDomain &&
            params.config.maxRenderingTimeout === cached.params.config.maxRenderingTimeout
        ) {
            // console.log("[Renderer] ♻️ Promise 재활용: ", decodeURIComponent(path.basename(key)));
            return cached.promise;
        }

        const promise: Promise<IRendererReturn> = new Promise(async (resolve, reject) => {
            let parseStart = performance.now();
            let result!: IRendererReturn;
            try {
                result = await renderer([params.parsedResult, { document: params.document, workspaceDocuments: params.workspaceDocuments, config: params.config, includeData: params.includeData, signal: params.signal }])
            } catch (err) {
                const isTimeout = err.message == "Timeout";
                const isTooLong = err.message == "render_too_long";
                const isAborted = err.message == "Abort";
                if (!isTimeout) console.error(err);

                return resolve({
                    html: "",
                    categories: [],
                    error: true,
                    errorCode: isAborted ? "aborted" : isTimeout ? "render_timeout" : isTooLong ? "render_too_long" : "render_failed",
                    errorMessage: err.stack,
                });
            }
            
            let parseEnd = performance.now();
            // console.log(
            //     "[Renderer] 📌 렌더링 중...",
            //     decodeURIComponent(path.basename(document.uri.toString())),
            //     "v",
            //     document.version,
            //     "(time: ",
            //     (parseEnd - parseStart).toFixed(2),
            //     "ms)"
            // );

            resolve(result);
        });

        // console.log("[Renderer] ⚙️ Promise 생성: ", decodeURIComponent(path.basename(key)), "v", version);

        RendererProvider.cache.set(key, { ...cached, version, promise, params });
        return promise;
    }

    static removeRendererPromise(document: vscode.TextDocument) {
        const key = document.uri.toString();
        RendererProvider.cache.delete(key)
    }
}

type WorkspaceItem = {
  title: string;
  namespace: string;
  content:
    | string
    | {
        fileKey: string;
        fileWidth: number;
        fileHeight: number;
        fileSize: number;
      };
};

function deepEqual(x: WorkspaceItem[], y: WorkspaceItem[]) {
  if (x.length !== y.length) return false
  for (let i = 0; i < x.length; i++) {
    let xv = x[i], yv = y[i]

    if (xv.title !== yv.title) return false
    if (xv.namespace !== yv.namespace) return false
    if (typeof xv.content !== typeof yv.content) return false
    if (typeof xv.content === "string" && xv.content !== yv.content) return false
    if (typeof xv.content === "object" && JSON.stringify(xv.content) !== JSON.stringify(yv.content)) return false
  }
  return true
}
