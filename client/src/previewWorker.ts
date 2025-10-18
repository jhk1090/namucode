import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import * as path from "path";

import { spawn, ChildProcess } from "child_process";
import * as crypto from "crypto";
import {
    ParsedData,
    ToHtmlOptions,
    IWorkerToHtmlMessage,
    IWorkerResponse,
    IWorkerToHtmlResponseSuccess,
    IWorkerParserMessage,
    IWorkerParserResponseSuccess,
    IWorkerResponseError,
} from "./types";

class WorkerManager {
    worker: ChildProcess | null = null;
    protected readonly workerPath: string;

    constructor(context: ExtensionContext) {
        this.workerPath = path.join(context.extensionPath, "client/media/parser", "index.js");
    }

    public dispose(): void {
        if (this.worker) {
            this.worker.kill("SIGTERM");
            this.worker = null;
        }
    }
}

interface ToHtmlPendingRequest {
    resolve: (value: IWorkerToHtmlResponseSuccess) => void;
    reject: (reason?: any) => void;
}

export class ToHtmlWorkerManager extends WorkerManager {
    private pendingRequests = new Map<string, ToHtmlPendingRequest>();

    constructor(context: ExtensionContext) {
        super(context);
        this.initializeWorker(context);
    }

    private initializeWorker(context: ExtensionContext): void {
        const config = vscode.workspace.getConfiguration("namucode");
        const nodePath = config.get<string>("nodePath", "node");

        this.worker = spawn(nodePath, [this.workerPath], {
            // 💥 표준 Node.js 경로를 사용합니다.
            stdio: ["ipc", "pipe", "pipe"], // IPC와 pipe를 모두 사용
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined,
                ATOM_SHELL_INTERNAL_RUN_AS_NODE: undefined,
            },
            windowsHide: true,
        });

        // Worker에서 메시지 수신 핸들러 설정
        this.worker.on("message", (response: IWorkerToHtmlResponseSuccess | IWorkerResponseError) => {
            const request = this.pendingRequests.get(response.id);
            if (!request) return;

            if (response.status === "success") {
                request.resolve(response as any);
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

    public remote(parsed: ParsedData, options: ToHtmlOptions): Promise<IWorkerToHtmlResponseSuccess> {
        if (!this.worker) {
            return Promise.reject(new Error("ToHtml Worker not active. Please reload the window."));
        }

        return new Promise((resolve, reject) => {
            const id = crypto.randomBytes(16).toString("hex");

            this.pendingRequests.set(id, { resolve, reject });

            const message: IWorkerToHtmlMessage = {
                id: id,
                command: "toHtml",
                parsed: parsed,
                options: options,
            };

            this.worker!.send(message);
        });
    }
}

interface ParserPendingRequest {
    resolve: (value: IWorkerParserResponseSuccess) => void;
    reject: (reason?: any) => void;
}

export class ParserWorkerManager extends WorkerManager {
    private pendingRequests = new Map<string, ParserPendingRequest>();

    constructor(context: ExtensionContext) {
        super(context);
        this.initializeWorker(context);
    }

    private initializeWorker(context: ExtensionContext): void {
        const config = vscode.workspace.getConfiguration("namucode");
        const nodePath = config.get<string>("nodePath", "node");

        this.worker = spawn(nodePath, [this.workerPath], {
            // 💥 표준 Node.js 경로를 사용합니다.
            stdio: ["ipc", "pipe", "pipe"], // IPC와 pipe를 모두 사용
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined,
                ATOM_SHELL_INTERNAL_RUN_AS_NODE: undefined,
            },
            windowsHide: true,
        });

        // Worker에서 메시지 수신 핸들러 설정
        this.worker.on("message", (response: IWorkerParserResponseSuccess | IWorkerResponseError) => {
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

    public remote(text: string): Promise<IWorkerParserResponseSuccess> {
        if (!this.worker) {
            return Promise.reject(new Error("ToHtml Worker not active. Please reload the window."));
        }

        return new Promise((resolve, reject) => {
            const id = crypto.randomBytes(16).toString("hex");

            this.pendingRequests.set(id, { resolve, reject });

            const message: IWorkerParserMessage = {
                id: id,
                command: "parser",
                text,
            };

            this.worker!.send(message);
        });
    }
}
