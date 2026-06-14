/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItemKind } from 'vscode-css-languageservice';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getWikiTagMode(): LanguageMode {
	return {
		getId() {
			return 'wiki-tag';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position) {
			return {
				isIncomplete: false,
				items: ["span", "a"].map(tag => ({
					label: tag,
					kind: CompletionItemKind.Enum
				}))
			};
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}