import { spawn, ChildProcess, spawnSync } from "child_process";
import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";
import { Worker } from "worker_threads";
import { IWorkerParserResponseSuccess, IWorkerResponseError, IWorkerToHtmlResponseSuccess, ToHtmlOptions } from "./types";

function runWorkerWithTimeout(workerFile: string, params: any, timeoutMs: number) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerFile);

        const timeout = setTimeout(() => {
            worker.terminate().then(() => reject(new Error("Timeout"))); // 강제 종료
        }, timeoutMs);

        worker.on("message", (msg) => {
            console.log("result", msg)
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
            worker.terminate();
        });

        worker.on("error", (err) => {
            console.log("error", err.stack)
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
}

interface IParseParams {
    text: string;
    config: IConfig;
}
interface IParseReturn {
    result: any;
    error: boolean;
    errorCode?: "parse_timeout" | "parse_failed";
    errorMessage?: string;
}

export const PARSE_FAILED_HEAD = "문서 파싱에 실패했습니다.";
export const PARSE_TIMEOUT_HEAD = "문서 파싱이 너무 오래 걸립니다.";
export async function parse(context: vscode.ExtensionContext, params: IParseParams): Promise<IParseReturn> {
    const workerFile = path.join(context.extensionPath, "client/media/parser/core", "parser.js");
    try {
        const result = await runWorkerWithTimeout(workerFile, params, params.config.maxParsingTimeout);
        return {
            result,
            error: false,
        };
    } catch (err) {
        const isTimeout = err.message == "Timeout";
        if (!isTimeout) console.error(err);

        return {
            result: null,
            error: true,
            errorCode: isTimeout ? "parse_timeout" : "parse_failed",
            errorMessage: err.stack,
        };
    }
}

interface IRenderParams {
    parsedResult: any;
    document: { namespace: string; title: string };
    workspaceDocuments: any[];
    config: IConfig;
}
interface IRenderReturn {
    html: string;
    categories: any[];
    error: boolean;
    errorCode?: "render_timeout" | "render_failed" | "render_too_long";
    errorMessage?: string;
}

export const RENDER_FAILED_HEAD = "문서 렌더링이 실패했습니다.";
export const RENDER_TIMEOUT_HEAD = "문서 렌더링이 너무 오래 걸립니다.";
export const RENDER_LENGTH_ERROR_HEAD = "문서 길이가 너무 깁니다.";
export async function render(context: vscode.ExtensionContext, params: IRenderParams): Promise<IRenderReturn> {
    const workerFile = path.join(context.extensionPath, "client/media/parser/core", "toHtml.js");
    try {
        const result: any = await runWorkerWithTimeout(workerFile, params, params.config.maxRenderingTimeout);
        return {
            html: result.html,
            categories: result.categories,
            error: false,
        };
    } catch (err) {
        const isTimeout = err.message == "Timeout";
        const isTooLong = err.message == "render_too_long";
        if (!isTimeout) console.error(err);

        return {
            html: "",
            categories: [],
            error: true,
            errorCode: isTimeout ? "render_timeout" : isTooLong ? "render_too_long" : "render_failed",
            errorMessage: err.stack,
        };
    }
}
