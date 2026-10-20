/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
	DocumentLink,
	FileChangeType,
	InitializeParams,
	ProposedFeatures,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { cache, foldingQuery, initTreeSitter, linkQuery, makeTree, updateTree } from './parser';
import { provideCompletion, registerClassSymbols, registerJSSymbols } from './completion';
import { provideDocumentSymbol } from './documentSymbol';
const parser = require("../../client/media/parser/core/parser.js");

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
export const documents = new Map<string, TextDocument>();

interface ParserSettings {
	maxParsingCharacter: number;
	maxParsingDepth: number;
}
interface CodeACSettings {
	disableCodeAnalysis: boolean;
	disableCompletion: boolean;
}

const defaultParserSettings = { maxParsingCharacter: 1500000, maxParsingDepth: 30 };
const defaultCodeACSettings = { disableCodeAnalysis: false, disableCompletion: false };

let defaultSettings: ParserSettings & CodeACSettings = { ...defaultParserSettings, ...defaultCodeACSettings };
let globalSettings: ParserSettings & CodeACSettings = defaultSettings;

const fileInitLocks = new Map<string, { promise: Promise<void>; resolve: () => void }>();

function getFileInitLock(uri: string): Promise<void> {
	if (!fileInitLocks.has(uri)) {
		let resolveFunc!: () => void;
		const promise = new Promise<void>((resolve) => {
			resolveFunc = resolve;
		});
		fileInitLocks.set(uri, { promise, resolve: resolveFunc });
	}
	return fileInitLocks.get(uri)!.promise;
}

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
					globPattern: "**/*.namu"
				}
			]
		})
		const latestSettings = await connection.workspace.getConfiguration("namucode")
		globalSettings = { ...latestSettings.parser, ...latestSettings.codeAnalysisCompletion }
	}

	resolveInitialization()
});

connection.onDidChangeConfiguration(async (_change) => {
	if (hasConfigurationCapability) {
		const latestSettings = (await connection.workspace.getConfiguration("namucode"));
		globalSettings = { ...latestSettings.parser, ...latestSettings.codeAnalysisCompletion }
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
		makeTree(document)
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
        makeTree(document);
    }
});


connection.onDidChangeWatchedFiles((change) => {
	for (const event of change.changes) {
		if (event.type === FileChangeType.Deleted) {
			const deletedUri = event.uri;
			if (documents.has(deletedUri)) {
				documents.delete(deletedUri)
			}
			if (cache.has(deletedUri)) {
				cache.delete(deletedUri)
			}
			console.log(`${deletedUri} 캐싱 삭제됨.`)
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
})

connection.onDidCloseTextDocument((params) => {
    const uri = params.textDocument.uri;

    documents.delete(uri);
    cache.delete(uri);

    connection.sendDiagnostics({
        uri,
        diagnostics: [],
    });
});

connection.onCompletion(async (params, _token) => {
	await initializationPromise;
	
	const document = documents.get(params.textDocument.uri);
	if (!document) return [];

	registerClassSymbols(document)
	registerJSSymbols(document)
	return provideCompletion(document, params.position, params.context)
});

connection.onFoldingRanges(async (params) => {
	await initializationPromise;

	const tree = cache.get(params.textDocument.uri)?.tree;
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

connection.onRequest("namucode/getParsedResult", async (params: { uri: string, isEditorComment: boolean; }) => {
	await initializationPromise;

	return parser(documents.get(params.uri).getText(), { editorComment: params.isEditorComment, maxParsingDepth: 30 })
})

connection.onDocumentLinks(async (params) => {
	await initializationPromise;

	const document = documents.get(params.textDocument.uri)
	const tree = cache.get(document.uri)?.tree;
		
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

// Listen on the connection
connection.listen();
