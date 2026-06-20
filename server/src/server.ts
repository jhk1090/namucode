/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CompletionList,
	CompletionTriggerKind,
	createConnection,
	Diagnostic,
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
	FileChangeType,
	InitializeParams,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { getLanguageModes, LanguageModes } from './languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideDocumentSymbol, TreeSymbol } from './documentSymbolSupport';
import { provideCompletionSupport } from './completionSupport';
const parser = require("../../client/media/parser/core/parser.js");

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new TextDocuments(TextDocument);

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

interface DocumentCacheValue {
  version: number;
	result: {
		common: any;
		minified: any;
		editorComment: any;
	};
  languageModes: LanguageModes | null;
	documentSymbol: TreeSymbol[];
  settings: { isLengthOverNotified: boolean } & ParserSettings;
}
export const documentCache = new Map<string, DocumentCacheValue>();
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

	documents.onDidClose(e => {
		connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
		// if (!languageModes) return
		// languageModes.onDocumentRemoved();
	});
	// connection.onShutdown(() => {
	// 	if (!languageModes) return
	// 	languageModes.dispose();
	// });

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', ':', '@', '\"', ';', ',', ' ', '='],

			},
			foldingRangeProvider: true,
			documentSymbolProvider: true,
			workspace: {
				workspaceFolders: {
					supported: true
				}
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

	// Revalidate all open text documents
	documents.all().forEach(async (document) => {
		await fetchDocumentSymbol(document)
		await validateTextDocument(document)
	});
});

connection.onDidChangeWatchedFiles((change) => {
	for (const event of change.changes) {
		if (event.type === FileChangeType.Deleted) {
			const deletedUri = event.uri;
			if (documentCache.has(deletedUri)) {
				console.log(`${deletedUri} 캐싱 삭제됨.`)
				documentCache.delete(deletedUri)
			}
		}
	}
})

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
	await initializationPromise;
	await fetchDocumentSymbol(change.document);
	await validateTextDocument(change.document);
});

async function fetchDocumentSymbol(document: TextDocument, isEditorComment: boolean = false, isMinified: boolean = true) {
	const settings = { editorComment: isEditorComment, minified: isMinified, maxParsingDepth: globalSettings.maxParsingDepth };
	const isLengthOver = document.getText().length > globalSettings.maxParsingCharacter
	
	const target = documentCache.get(document.uri)

	let isLengthOverNotified = target?.settings?.isLengthOverNotified ?? false;
	
	if (isLengthOver) {
    if (!isLengthOverNotified) {
      connection.window.showWarningMessage(
        `코드 분석 및 자동 완성 최대 글자 수인 ${globalSettings.maxParsingCharacter}자가 넘어가 코드 분석과 자동 완성이 중지되었습니다.`,
      );
    }
    isLengthOverNotified = true;
    documentCache.set(document.uri, {
      version: document.version,
			result: {
				common: null,
				editorComment: null,
				minified: null
			},
      languageModes: null,
			documentSymbol: [],
      settings: { ...globalSettings, isLengthOverNotified },
    });
		return;
  }

	if (!isLengthOver && isLengthOverNotified) {
    isLengthOverNotified = false;
  }

	if (target && isEditorComment && !isMinified) {
		let editorCommentParsedResult = target.result.editorComment;
		if (!editorCommentParsedResult) {
			editorCommentParsedResult = parser(document.getText(), settings);
			documentCache.set(document.uri, { ...target, result: { ...target.result, editorComment: editorCommentParsedResult } })
		}
		return editorCommentParsedResult
	}

	if (target && !isMinified) {
		let commonResult = target.result.common;
		if (!commonResult) {
			commonResult = parser(document.getText(), settings);
			documentCache.set(document.uri, { ...target, result: { ...target.result, common: commonResult } })
		}
		return commonResult
	}

	const isConfigurationUnchanged = (
		target &&
		target.version === document.version &&
		target.settings.maxParsingDepth === globalSettings.maxParsingDepth &&
		target.settings.maxParsingCharacter === globalSettings.maxParsingCharacter
	)

	if (isConfigurationUnchanged) {
		return;
	}

	const result = parser(document.getText(), settings);
  documentCache.set(document.uri, {
    version: document.version,
		result: {
			common: null,
			minified: result,
			editorComment: null
		},
    languageModes: getLanguageModes(result, document),
		documentSymbol: provideDocumentSymbol(document, result),
    settings: { ...globalSettings, isLengthOverNotified },
  });

	if (fileInitLocks.has(document.uri)) {
		fileInitLocks.get(document.uri)!.resolve();
	} else {
		const promise = Promise.resolve();
		fileInitLocks.set(document.uri, { promise, resolve: () => {} });
	}

	
}

async function validateTextDocument(textDocument: TextDocument) {
	if (globalSettings.disableCodeAnalysis) {
		connection.sendDiagnostics({ uri: documents.get(textDocument.uri).uri, diagnostics: [] })
		return;
	}

	const languageModes = documentCache.get(textDocument.uri)?.languageModes;
	if (!languageModes) return;

	try {
		const version = textDocument.version;
		const diagnostics: Diagnostic[] = [];
		if (textDocument.languageId === 'namu') {
			const modes = languageModes.getAllModesInDocument();
			const latestTextDocument = documents.get(textDocument.uri);
			if (latestTextDocument && latestTextDocument.version === version) {
				// check no new version has come in after in after the async op
				modes.forEach(mode => {
					if (mode.doValidation) {
						mode.doValidation(textDocument).forEach(d => {
							diagnostics.push(d);
						});
					}
				});
				// console.log(diagnostics)
				connection.sendDiagnostics({ uri: latestTextDocument.uri, diagnostics });
			}
		}
	} catch (e) {
		connection.console.error(`Error while validating ${textDocument.uri}`);
		connection.console.error(String(e));
	}
}

connection.onCompletion(async (textDocumentPosition, _token) => {
	if (globalSettings.disableCompletion) {
		return null;
	}

	const document = documents.get(textDocumentPosition.textDocument.uri);
	if (!document) {
		return null;
	}

	await getFileInitLock(document.uri)
	
	return provideCompletionSupport(document, textDocumentPosition.position, textDocumentPosition.context)
});

connection.onFoldingRanges(async (params) => {
	const document = documents.get(params.textDocument.uri)
	await getFileInitLock(document.uri)

	const ranges = [];
	const minified = documentCache.get(document.uri)?.result?.minified;
	const headings = minified.data.headings;
	for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];

    const startLine = heading.line - 1;
    const endLine = nextHeading ? nextHeading.line - 2 : document.lineCount - 1;

    ranges.push({ startLine, endLine });
  }
	return [...ranges, ...minified.data.foldingRanges]
})

connection.onDocumentSymbol(async (params) => {
	const document = documents.get(params.textDocument.uri)
	await getFileInitLock(document.uri)
	return documentCache.get(document.uri).documentSymbol
})

connection.onRequest("namucode/getParsedResult", async (params: { uri: string, isEditorComment: boolean; }) => {
	await getFileInitLock(params.uri)
	return params.isEditorComment ? fetchDocumentSymbol(documents.get(params.uri), true, false) : fetchDocumentSymbol(documents.get(params.uri), false, false)
})

connection.onRequest("namucode/getDocumentSymbol", async (params: { uri: string }) => {
	await getFileInitLock(params.uri)
	return documentCache.get(params.uri).documentSymbol
})

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
