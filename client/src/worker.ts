import * as path from "path";
import * as vscode from "vscode";
import { Worker } from "worker_threads";

export async function warmupWorker(context: vscode.ExtensionContext) {
    const workspaceConfig = vscode.workspace.getConfiguration("namucode.preview.parser");
    const doWarmup = workspaceConfig.get<boolean>("doWarmup", true);
    if (!doWarmup) {
        return
    }

    const config = {
        maxLength: 5000000,
        maxRenderingTimeout: 10000,
        maxParsingTimeout: 7000,
        maxParsingDepth: 30,
        extensionPath: context.extensionUri.fsPath
    };
    const { signal } = new AbortController();
    await render(context, {
        parsedResult: {
            tokens: null,
            result: [],
            data: {
                links: [],
                categories: [],
                includes: [],
                includeParams: {},
                headings: [],
            },
        },
        document: { namespace: "문서", title: "" },
        workspaceDocuments: [],
        config,
        signal,
        includeData: null,
    });
}

function runWorkerWithTimeout(workerFile: string, params: any, timeoutMs: number, signal: AbortSignal) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerFile);

        const timeout = setTimeout(() => {
            worker.terminate().then(() => reject(new Error("Timeout"))); // 강제 종료
        }, timeoutMs);

        signal.addEventListener("abort", () => {
            worker.terminate().then(() => reject(new Error("Abort"))); // 강제 종료
        })

        worker.on("message", (msg) => {
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
            worker.terminate();
        });

        worker.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        worker.postMessage(params);
    });
}

interface IConfig {
    maxLength: number;
    maxRenderingTimeout: number;
    maxParsingTimeout: number;
    onlyHeading?: boolean;
    isEditorComment?: boolean;
}

interface IRenderParams {
    parsedResult: any;
    document: { namespace: string; title: string };
    workspaceDocuments: any[];
    config: IConfig;
    includeData: { [key: string]: string };
    signal: AbortSignal;
}
interface IRenderReturn {
    html: string;
    categories: any[];
    error: boolean;
    errorCode?: "render_timeout" | "render_failed" | "render_too_long" | "aborted";
    errorMessage?: string;
}

export const RENDER_FAILED_HEAD = "문서 렌더링이 실패했습니다.";
export const RENDER_TIMEOUT_HEAD = "문서 렌더링이 너무 오래 걸립니다.";
export const RENDER_LENGTH_ERROR_HEAD = "문서 길이가 너무 깁니다.";
export async function render(context: vscode.ExtensionContext, params: IRenderParams): Promise<IRenderReturn> {
    const workerFile = path.join(context.extensionPath, "dist/parser", "toHtml.js");
    try {
        const result: any = await runWorkerWithTimeout(workerFile, params, params.config.maxRenderingTimeout, params.signal);
        return {
            html: result.html,
            categories: result.categories,
            error: false,
        };
    } catch (err) {
        const isTimeout = err.message == "Timeout";
        const isTooLong = err.message == "render_too_long";
        const isAborted = err.message == "Abort";
        if (!isTimeout) console.error(err);

        return {
            html: "",
            categories: [],
            error: true,
            errorCode: isAborted ? "aborted" : isTimeout ? "render_timeout" : isTooLong ? "render_too_long" : "render_failed",
            errorMessage: err.stack,
        };
    }
}
