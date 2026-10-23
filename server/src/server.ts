/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CodeAction,
	CodeActionKind,
	Command,
	createConnection,
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
	DocumentLink,
	FileChangeType,
	InitializeParams,
	ProposedFeatures,
	Range,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parserCache, foldingQuery, initTreeSitter, linkQuery, updateTree } from './parser';
import { provideCompletion, registerClassSymbols, registerJSSymbols } from './completion';
import { provideDocumentSymbol } from './documentSymbol';
import { updateDiagnostics } from './diagnostics';
import { getPreviewData, previewParserCache, previewRendererCache, previewWorkspaceDocumentsCache } from './preview';
import path from "node:path";

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents = new Map<string, TextDocument>();

interface PreviewSettings {
	internalLinkDomain: string;
	workspaceReference: boolean;
	maxLength: number;
	maxRenderingTimeout: number;
}
interface ParserSettings {
	maxParsingCharacter: number;
	maxParsingDepth: number;
}
interface CodeACSettings {
	disableCodeAnalysis: boolean;
	disableCompletion: boolean;
}

const defaultPreviewSettings = { internalLinkDomain: "https://namu.wiki", workspaceReference: true, maxLength: 5000000, maxRenderingTimeout: 10 };
const defaultParserSettings = { maxParsingCharacter: 1500000, maxParsingDepth: 30 };
const defaultCodeACSettings = { disableCodeAnalysis: false, disableCompletion: false };

let defaultSettings: ParserSettings & CodeACSettings & PreviewSettings = { ...defaultParserSettings, ...defaultCodeACSettings, ...defaultPreviewSettings };
export let globalSettings: ParserSettings & CodeACSettings & PreviewSettings = defaultSettings;

let hasConfigurationCapability = false;
let resolveInitialization: () => void;
const initializationPromise = new Promise<void>((resolve) => {
	resolveInitialization = resolve;
})


connection.onInitialize(async (_params: InitializeParams) => {
	const capabilities = _params.capabilities;

	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);

	await initTreeSitter()

	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental	
			},
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: [
					'.', ':', '@', '\"', ';', ',', ' ', '=', '|', '&', '[', "+", "-", "#", "!", '<', "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
				],

			},
			foldingRangeProvider: true,
			documentSymbolProvider: true,
			documentLinkProvider: {
				resolveProvider: false
			},
			workspace: {
				workspaceFolders: {
					supported: true
				}
			},
			codeActionProvider: {
				codeActionKinds: [
					CodeActionKind.RefactorRewrite
				]
			}
			// hoverProvider: true,
			// definitionProvider: true,
		}
	};
});

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
		connection.client.register(DidChangeWatchedFilesNotification.type, {
			watchers: [
				{
					globPattern: "{**/*.namu,**/*.png,**/*.jpg,**/*.jpeg,**/*.svg,**/*.gif,**/*.webp}"
				}
			]
		})
		const latestSettings = await connection.workspace.getConfiguration("namucode")
		globalSettings = { ...latestSettings.parser, ...latestSettings.codeAnalysisCompletion, ...latestSettings.preview }
	}

	resolveInitialization()
});

connection.onDidChangeConfiguration(async (_change) => {
	if (hasConfigurationCapability) {
		const latestSettings = (await connection.workspace.getConfiguration("namucode"));
		globalSettings = { ...latestSettings.parser, ...latestSettings.codeAnalysisCompletion, ...latestSettings.preview }
	} else {
		const globalParserSettings = (
			_change.settings.namucode.parser || defaultParserSettings
		)
		const globalCodeACSettings = (
			_change.settings.namucode.codeAnalysisCompletion || defaultCodeACSettings
		)
		globalSettings = { ...globalParserSettings, ...globalCodeACSettings }
	}

	[...documents.values()].forEach(document => {
		updateTree({ textDocument: { languageId: document.languageId, text: document.getText(), uri: document.uri, version: document.version } });
		updateDiagnostics(document);
	})
});

connection.onDidOpenTextDocument(async (params) => {
	await initializationPromise;

	const item = params.textDocument;
	const document = TextDocument.create(
			item.uri,
			item.languageId,
			item.version,
			item.text,
	);

	documents.set(item.uri, document);

	if (document.languageId === "namu") {
		updateTree({ textDocument: params.textDocument })
		updateDiagnostics(document);
	}
});


connection.onDidChangeWatchedFiles((change) => {
	for (const event of change.changes) {
		if (event.type === FileChangeType.Deleted && path.extname(event.uri) === ".namu") {
			const deletedUri = event.uri;
			documents.delete(deletedUri)
			parserCache.delete(deletedUri)
			previewParserCache.delete(deletedUri)
			previewRendererCache.delete(deletedUri)
		}

		// previewWorkspaceDocumentsCache는 감시되는 파일의 변동 시 캐싱을 삭제함
		if (event.type === FileChangeType.Changed && path.extname(event.uri) === ".namu") {
			// A 파일에서 내용 변경 없는 단순 저장이 이뤄지더라도 A 파일만 캐싱이 수정되지 않도록
			for (const key of previewWorkspaceDocumentsCache.keys()) {
				if (key === event.uri) continue;
				previewWorkspaceDocumentsCache.delete(key)
			}
		} else {
			previewWorkspaceDocumentsCache.clear()
		}
	}
})

connection.onDidChangeTextDocument(async (params) => {
	await initializationPromise;

	const uri = params.textDocument.uri;
	const oldDocument = documents.get(uri);

	if (!oldDocument) return;

	const document = TextDocument.update(
			oldDocument,
			params.contentChanges,
			params.textDocument.version,
	);

	documents.set(uri, document);
	updateTree(params);
	updateDiagnostics(document);
})

connection.onDidCloseTextDocument((params) => {
    const uri = params.textDocument.uri;

    documents.delete(uri);
    parserCache.delete(uri);
		previewParserCache.delete(uri);
		previewRendererCache.delete(uri);
		previewWorkspaceDocumentsCache.delete(uri);

    connection.sendDiagnostics({
        uri,
        diagnostics: [],
    });
});

connection.onCompletion(async (params, _token) => {
	await initializationPromise;
	if (globalSettings.disableCompletion) return [];

	const document = documents.get(params.textDocument.uri);
	if (!document) return [];

	registerClassSymbols(document)
	registerJSSymbols(document)
	return provideCompletion(document, params.position, params.context)
});

connection.onFoldingRanges(async (params) => {
	await initializationPromise;

	const tree = parserCache.get(params.textDocument.uri)?.tree;
	if (!tree) return [];
	
	const matches = foldingQuery.matches(tree.rootNode);

	const result = [];

	for (const match of matches) {
		const node = match.captures[0].node;
		const startLine = node.startPosition.row;
		const endLine = node.type === "section" ? node.endPosition.row : node.endPosition.row - 1;

		if (endLine - startLine < 1) {
				continue;
		}

		result.push({ startLine, endLine });
	}

	return result;
})

connection.onDocumentSymbol(async (params) => {
	await initializationPromise;

	return provideDocumentSymbol(params);
})

connection.onRequest("namucode/getPreviewData", async (params: { uri: string, isEditorComment: boolean; includeData: Record<string, string> }) => {
	await initializationPromise;

	return getPreviewData(params.uri, params.isEditorComment, params.includeData)
})

connection.onDocumentLinks(async (params) => {
	await initializationPromise;

	const document = documents.get(params.textDocument.uri)
	const tree = parserCache.get(document.uri)?.tree;
		
	if (!tree) {
		return [];
	}

	const result: DocumentLink[] = []
	for (const { name, node } of linkQuery.captures(tree.rootNode)) {
		if (name === "link") {
			if (node.children.find(child => child.type === "argument")) continue;

			const start = document.positionAt(node.startIndex);
			const end = document.positionAt(node.endIndex);

			const isExternalLink = /^(http(s)?|ftp)/.test(node.text);
			result.push({ range: { start, end }, target: isExternalLink ? node.text : "https://namu.wiki/w/" + node.text })
			continue;
		}
		if (name === "macro") {
			if (node.children.find(child => child.type === "argument")) continue;

			const macroName = node.namedChild(1);
			const macroContent = node.namedChild(2);
			
			const firstCommaRegex = /(?<!\\)(?:\\\\)*,/;

			const match = macroContent.text.match(firstCommaRegex)

			const start = document.positionAt(macroContent.startIndex)
			const end = document.positionAt(
				match ? macroContent.startIndex + match.index : macroContent.endIndex
			)

			const urls = {
				youtube: "https://youtube.com/watch?v=",
				kakaotv: "https://tv.kakao.com/v/",
				nicovideo: "https://www.nicovideo.jp/watch/",
				vimeo: "https://vimeo.com/",
				navertv: "https://tv.naver.com/v/",
				include: "https://namu.wiki/w/",
			}
			const target = urls[macroName.text] + (match ? macroContent.text.slice(0, match.index) : macroContent.text)

			result.push({ range: { start, end }, target })

			continue;
		}
	}

	return result;
})

connection.onCodeAction(async (params) => {
	await initializationPromise;

	const document = documents.get(params.textDocument.uri)
	const tree = parserCache.get(document.uri)?.tree;
		
	if (!tree) {
		return [];
	}

	const result: (Command | CodeAction)[] = [];

	if (
		params.range.start.line !== params.range.end.line ||
		params.range.start.character !== params.range.end.character
	) {
		result.push({
			title: "선택 영역 구문 감싸기",
			kind: CodeActionKind.RefactorRewrite,
			command: {
				command: 'namucode.wrapSelection',
				title: "선택 영역 구문 감싸기",
				arguments: [document.uri, params.range]
			}
    })
	}

	const positionIndex = document.offsetAt(params.range.start);

	let currentNode = tree.rootNode.descendantForIndex(positionIndex);
	const blockTypeLabels = {
		"if_block": "#!if",
		"folding_block": "#!folding",
		"syntax_block": "#!syntax",
		"wiki_block": "#!wiki",
		"html_block": "#!html",
		"style_block": "#!style",
		"latex_block": "#!latex",
		"scale_block": "크기",
		"color_block": "색상",
		"nowiki": "삼중괄호",
	}
	while (currentNode.parent) {
		currentNode = currentNode.parent;

		if (!(currentNode.type in blockTypeLabels) || currentNode.children.at(-1)?.type !== "bracket_end") continue;

		const contentNode = currentNode.childForFieldName("content") ?? { text: "" }

		result.push({
			title: `선택 영역 구문 벗기기: ${blockTypeLabels[currentNode.type]} 구문`,
			kind: CodeActionKind.RefactorRewrite,
			edit: {
				changes: {
					[document.uri]: [{
						range: Range.create(
							document.positionAt(currentNode.startIndex),
							document.positionAt(currentNode.endIndex)
						),
						newText: contentNode.text
					}]
				}
			}
		})

		break;
	}

	return result
})
// Listen on the connection
connection.listen();
