import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import * as path from "path";

import { spawnSync, spawn, ChildProcess } from "child_process";
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
    protected worker: ChildProcess | null = null;
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

    public isAlive(): boolean {
        return this.worker !== null
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
        
        let isError = false
        try {
            const result = spawnSync(nodePath, ["--version"], { encoding: "utf8" });

            if (result.error) {
                if ((result.error as any).code === "ENOENT") {
                    vscode.window.showErrorMessage(`미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다. Node.js 실행 파일을 찾을 수 없습니다: ${nodePath}`);
                    isError = true
                } else {
                    vscode.window.showErrorMessage(`Node.js 실행 중 오류가 발생했습니다: ${result.error.message}`);
                    isError = true
                }
            } else {
                const version = result.stdout.trim()
                const match = version.match(/^v(\d+)\.(\d+)\.(\d+)/);
                if (+match[1] < 22) {
                    vscode.window.showErrorMessage(`미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다.`);
                    isError = true
                }
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Node.js 실행에 실패했습니다: ${err.message}`);
            isError = true
        }

        if (isError) {
            this.worker = null;
            return;
        }

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

        let isError = false
        try {
            const result = spawnSync(nodePath, ["--version"], { encoding: "utf8" });

            if (result.error) {
                if ((result.error as any).code === "ENOENT") {
                    vscode.window.showErrorMessage(`미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다. Node.js 실행 파일을 찾을 수 없습니다: ${nodePath}`);
                    isError = true
                } else {
                    vscode.window.showErrorMessage(`Node.js 실행 중 오류가 발생했습니다: ${result.error.message}`);
                    isError = true
                }
            } else {
                const version = result.stdout.trim()
                const match = version.match(/^v(\d+)\.(\d+)\.(\d+)/);
                if (+match[1] < 22) {
                    vscode.window.showErrorMessage(`미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다.`);
                    isError = true
                }
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Node.js 실행에 실패했습니다: ${err.message}`);
            isError = true
        }

        if (isError) {
            this.worker = null;
            return;
        }

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
