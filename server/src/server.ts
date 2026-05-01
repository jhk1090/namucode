/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	CompletionList,
	createConnection,
	Diagnostic,
	InitializeParams,
	ProposedFeatures,
	RequestType,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { getLanguageModes, LanguageModes } from './languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
export const GetDocumentSymbolFromClientRequest = new RequestType<string, object, void>('namucode/getDocumentSymbol');

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents = new TextDocuments(TextDocument);



let languageModes: LanguageModes | null;

connection.onInitialize(async (_params: InitializeParams) => {
	documents.onDidClose(e => {
		if (!languageModes) return
		languageModes.onDocumentRemoved();
	});
	connection.onShutdown(() => {
		if (!languageModes) return
		languageModes.dispose();
	});

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			// Tell the client that the server supports code completion
			completionProvider: {
				resolveProvider: false,
				triggerCharacters: ['.', '#', ':', '@', ' ']
			}
		}
	};
});

connection.onDidChangeConfiguration(_change => {
	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
	await fetchDocumentSymbol(change.document);
	await validateTextDocument(change.document);
});

async function fetchDocumentSymbol(document: TextDocument) {
	const documentSymbol = await connection.sendRequest("namucode/getDocumentSymbol") as Object;
	languageModes = getLanguageModes(documentSymbol, document);
}

async function validateTextDocument(textDocument: TextDocument) {
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
	const document = documents.get(textDocumentPosition.textDocument.uri);
	if (!document) {
		return null;
	}
	if (!languageModes) return null;

	const mode = languageModes.getModeAtPosition(textDocumentPosition.position);
	if (!mode || !mode.doComplete) {
		return CompletionList.create();
	}
	const doComplete = mode.doComplete!;

	return doComplete(document, textDocumentPosition.position);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
