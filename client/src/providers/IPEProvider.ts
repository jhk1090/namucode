import * as vscode from "vscode";

export class IPEProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'namucode-includeParameterEditor';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _externContext: vscode.ExtensionContext
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(msg => {
			if (msg.type === 'update') {
				const data = JSON.parse(msg.data)
				this._externContext.workspaceState.update('includeParameterEditorInput', Object.keys(data).length === 0 ? null : data);
				vscode.commands.executeCommand("namucode.retryPreview")
			}
		});

		// 초기 설정
		const editorInput = this._externContext.workspaceState.get("includeParameterEditorInput") as { [key: string]: string } | null;
		webviewView.webview.postMessage(editorInput ? Object.entries(editorInput).map(([key, value]) => `${key}=${value}`).join(", ") : "")
	}

	public addColor() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'addColor' });
		}
	}

	public clearColors() {
		if (this._view) {
			this._view.webview.postMessage({ type: 'clearColors' });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist/media/IPEStyle.css')); /* IPE = includeParameterProvider */
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist/media/IPEScript.js'));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleUri}" rel="stylesheet" nonce="${nonce}">

				<title>Cat Colors</title>
			</head>
			<body>
				<h3>매개변수 편집기</h3>
				<p>미리보기에 적용될 매개변수를 지정해보세요! <code>매개변수=값</code> 꼴로 지정할 수 있으며, 쉼표로 구분해 여러 매개변수를 넣을 수 있습니다. <code>\\,</code> 또는 <code>\\=</code>와 같은 이스케이프 문자도 적용 가능합니다.</p>
				<p>적용 시 현재 열려있는 미리보기와 앞으로 열리는 미리보기 모두를 대상으로 적용됩니다. 단, 이 기능을 사용하면 중첩 include문 방지로 인해 include 문법을 사용할 수 없습니다.</p>
				<p>매개변수를 입력했다면 하단의 <b>적용 버튼</b>을 눌러주세요! 적용 버튼을 눌러야만 반영됩니다.</p>
				<p id="error">매개변수 형식이 잘못되었습니다. 도움말이 필요하다면 <a href="https://github.com/jhk1090/namucode/blob/main/docs/preview.md#q-틀-매개변수-편집기-사용-중-매개변수-형식이-잘못되었습니다라고-뜹니다">여기</a>를 참고하세요.</p>
				<textarea id="input" style="width: 100%" placeholder="예시) 매개변수1=사과, 매개변수2=바나나"></textarea>
				<div id="button-group">
					<button id="apply" style="width: 100%; padding: 5px;">적용</button>
					<button id="reset" style="width: 100%; padding: 5px;">초기화</button>
				</div>
				<script nonce="${nonce}" src="${scriptUri}" nonce="${nonce}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}