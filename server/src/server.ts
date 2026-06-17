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
	InitializeParams,
	ProposedFeatures,
	SemanticTokensBuilder,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { getLanguageModes, LanguageModes } from './languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { simpleCompletions } from './simpleCompletions';
import { provideFoldingRanges } from './foldingSupport';
import { provideDocumentSymbol, TreeSymbol } from './documentSymbolSupport';
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
  parsedResult: any;
	editorCommentParsedResult: any;
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

const tokenTypes = ["heading"]

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
				triggerCharacters: ['.', '#', ':', '@', '\"', ';', ' ', '!', '[', '+', '-', '|', '=', '&', '<', ',']
			},
			foldingRangeProvider: true,
			semanticTokensProvider: {
				legend: {
					tokenTypes,
					tokenModifiers: []
				},
				full: true
			},
			documentSymbolProvider: true
			// hoverProvider: true,
			// definitionProvider: true,
		}
	};
});

connection.onInitialized(async () => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
	await initializationPromise;
	await fetchDocumentSymbol(change.document);
	await validateTextDocument(change.document);
});

async function fetchDocumentSymbol(document: TextDocument, isEditorComment: boolean = false) {
	const settings = { editorComment: isEditorComment, maxParsingDepth: globalSettings.maxParsingDepth };
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
      parsedResult: null,
			editorCommentParsedResult: null,
      languageModes: null,
			documentSymbol: [],
      settings: { ...settings, ...globalSettings, isLengthOverNotified },
    });
		return;
  }

	if (!isLengthOver && isLengthOverNotified) {
    isLengthOverNotified = false;
  }

	if (target && isEditorComment) {
		let editorCommentParsedResult = target.editorCommentParsedResult;
		if (!editorCommentParsedResult) {
			editorCommentParsedResult = parser(document.getText(), settings);
			documentCache.set(document.uri, { ...target, editorCommentParsedResult })
		}
		return editorCommentParsedResult
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
    parsedResult: result,
		editorCommentParsedResult: null,
    languageModes: getLanguageModes(result, document),
		documentSymbol: provideDocumentSymbol(document, result),
    settings: { ...settings, ...globalSettings, isLengthOverNotified },
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
	
	const simpleCompletionsResult = simpleCompletions(document, textDocumentPosition.position, textDocumentPosition.context.triggerCharacter, textDocumentPosition?.context?.triggerKind === CompletionTriggerKind.Invoked);

	if (simpleCompletionsResult) {
		return simpleCompletionsResult
	}

	const languageModes = documentCache.get(textDocumentPosition.textDocument.uri)?.languageModes;
	if (!languageModes) return null;

	const line = document.getText({ start: { line: textDocumentPosition.position.line, character: 0 }, end: textDocumentPosition.position });

	if (textDocumentPosition.context.triggerCharacter === "@" && /(?<!@[\p{L}\p{N}_]*(=[^\n\r@]+)?)@$/gu.exec(line)) {
		return languageModes.getMode("js").doComplete(document, textDocumentPosition.position, { isArgumentCompletion: true })
	}

	const mode = languageModes.getModeAtPosition(textDocumentPosition.position);
	if (!mode || !mode.doComplete) {
		return CompletionList.create();
	}
	const doComplete = mode.doComplete!;

	return doComplete(document, textDocumentPosition.position);
});

connection.onFoldingRanges(async (params) => {
	return provideFoldingRanges(documents.get(params.textDocument.uri))
})

connection.languages.semanticTokens.on((params) => {
	const document = documents.get(params.textDocument.uri)

	const result = documentCache.get(document.uri)?.parsedResult
	const headings = result ? result.data.headings : []

	const tokensBuilder = new SemanticTokensBuilder()

	for (const heading of headings) {
		const line = heading.line - 1
		const lineText = document.getText().split(/\r?\n/)[line]
		tokensBuilder.push(line, 0, lineText.length, tokenTypes.indexOf("heading"), 0);
	}
	
	return tokensBuilder.build();
})

connection.onDocumentSymbol(async (params) => {
	const document = documents.get(params.textDocument.uri)
	await getFileInitLock(document.uri)
	return documentCache.get(document.uri).documentSymbol
})

connection.onRequest("namucode/getParsedResult", async (params: { uri: string, isEditorComment: boolean; }) => {
	await getFileInitLock(params.uri)
	return params.isEditorComment ? fetchDocumentSymbol(documents.get(params.uri), true) : documentCache.get(params.uri).parsedResult
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
