import { spawn, ChildProcess, spawnSync } from "child_process";
import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";
import { IWorkerParserResponseSuccess, IWorkerResponseError, IWorkerToHtmlResponseSuccess, ToHtmlOptions } from "./types";

export async function warmupWorker(context: vscode.ExtensionContext) {
    const { errorMessage } = getWorkerConfig(context)
    if (!errorMessage) {
        const { parsed } = await parserRemote(context, "", {})
        await toHtmlRemote(context, parsed, { document: { namespace: "문서", title: "" }, workspaceDocuments: [], config: {} });
    }
}

export function getWorkerConfig(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration("namucode.preview.parser");
    const nodePath = config.get<string>("nodePath", "node");
    const workerScriptPath = path.join(context.extensionPath, "client/media/parser", "index.js");

    let errorMessage: string | null = null;
    try {
        const result = spawnSync(nodePath, ["--version"], { encoding: "utf8" });

        if (result.error) {
            if ((result.error as any).code === "ENOENT") {
                errorMessage = `미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다. Node.js 실행 파일을 찾을 수 없습니다: ${nodePath}`
            } else {
                errorMessage = `Node.js 실행 중 오류가 발생했습니다: ${result.error.message}`
            }
        } else {
            const version = result.stdout.trim();
            const match = version.match(/^v(\d+)\.(\d+)\.(\d+)/);
            if (+match[1] < 22) {
                errorMessage = `미리보기 기능을 실행하려면 Node.js 22 이상이 필요합니다.`
            }
        }
    } catch (err: any) {
        errorMessage = `Node.js 실행에 실패했습니다: ${err.message}`
    }

    return { nodePath, workerScriptPath, errorMessage };
}

/**
 * Child Process를 생성, 실행, 종료하여 toHtml 로직을 처리합니다.
 * @returns HTML 결과를 담은 Promise
 */
export function toHtmlRemote(context: vscode.ExtensionContext, parsed: any, options: ToHtmlOptions): Promise<IWorkerToHtmlResponseSuccess> {
    return new Promise((resolve, reject) => {
        const { nodePath, workerScriptPath, errorMessage } = getWorkerConfig(context);
        if (errorMessage) {
            reject(errorMessage)
            return
        }

        const id = crypto.randomBytes(16).toString("hex");

        const worker = spawn(nodePath, [workerScriptPath], {
            stdio: ["ignore", "inherit", "inherit", "ipc"],
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined,
                ATOM_SHELL_INTERNAL_RUN_AS_NODE: undefined,
            },
            windowsHide: true,
        });

        worker.on("message", (response: IWorkerToHtmlResponseSuccess | IWorkerResponseError) => {
            worker.kill();

            if (response.id !== id) {
                return reject(new Error("워커가 요청한 ID와 다른 ID를 반환했습니다."));
            }

            if (response.status === "success") {
                resolve(response as IWorkerToHtmlResponseSuccess);
            } else {
                reject(new Error(response.message || "예기치 않은 워커 오류"));
            }
        });

        worker.on("error", (err) => {
            reject(new Error(`워커 실행에 실패했습니다: ${err.message}`));
            worker.kill();
        });

        worker.on("close", (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`워커가 코드 ${code}와 함께 종료되었습니다.`));
            }
        });

        const message: any = { id: id, command: "toHtml", parsed, options };
        worker.send(message);
    });
}

export function parserRemote(context: vscode.ExtensionContext, text: string, config: any): Promise<IWorkerParserResponseSuccess> {
    return new Promise((resolve, reject) => {
        const { nodePath, workerScriptPath, errorMessage } = getWorkerConfig(context);
        if (errorMessage) {
            reject(errorMessage)
            return
        }

        const id = crypto.randomBytes(16).toString("hex");

        const worker = spawn(nodePath, [workerScriptPath], {
            stdio: ["ignore", "inherit", "inherit", "ipc"], // IPC와 pipe를 모두 사용
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: undefined,
                ATOM_SHELL_INTERNAL_RUN_AS_NODE: undefined,
            },
            windowsHide: true,
        });

        worker.on("message", (response: IWorkerParserResponseSuccess | IWorkerResponseError) => {
            worker.kill();

            if (response.id !== id) {
                return reject(new Error("워커가 요청한 ID와 다른 ID를 반환했습니다."));
            }

            if (response.status === "success") {
                resolve(response as IWorkerParserResponseSuccess);
            } else {
                reject(new Error(response.message || "예기치 않은 워커 오류"));
            }
        });

        worker.on("error", (err) => {
            reject(new Error(`워커 실행에 실패했습니다: ${err.message}`));
            worker.kill();
        });

        worker.on("close", (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`워커가 코드 ${code}와 함께 종료되었습니다.`));
            }
        });

        const message: any = { id: id, command: "parser", text, config };
        worker.send(message);
    });
}
