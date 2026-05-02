/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItemKind } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getWikiLangMode(): LanguageMode {
	return {
		getId() {
			return 'wiki-lang';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			// const wikiLangRegions = documentRegions.getLanguageRanges(fullRange)
			// 	.filter(r => r.languageId === 'wiki-lang');

			return {
				isIncomplete: false,
				items: languageList.map(language => ({
					label: language.label,
					kind: CompletionItemKind.Enum,
					documentation: language.documentaion
				}))
			};
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}

const languageList = [
  { label: "ar", documentaion: "Arabic" },
  { label: "cs", documentaion: "Czech" },
  { label: "da", documentaion: "Danish" },
  { label: "de", documentaion: "German" },
  { label: "el", documentaion: "Greek" },
  { label: "en", documentaion: "English" },
  { label: "en-GB", documentaion: "English (UK)" },
  { label: "en-US", documentaion: "English (US)" },
  { label: "es", documentaion: "Spanish" },
  { label: "fi", documentaion: "Finnish" },
  { label: "fr", documentaion: "French" },
  { label: "he", documentaion: "Hebrew" },
  { label: "hi", documentaion: "Hindi" },
  { label: "hu", documentaion: "Hungarian" },
  { label: "id", documentaion: "Indonesian" },
  { label: "it", documentaion: "Italian" },
  { label: "ja", documentaion: "Japanese" },
  { label: "ja-JP", documentaion: "Japanese (Japan)" },
  { label: "ko", documentaion: "Korean" },
  { label: "ko-KR", documentaion: "Korean (South Korea)" },
  { label: "la", documentaion: "Latin" },
  { label: "mn", documentaion: "Mongolian" },
  { label: "ms", documentaion: "Malay" },
  { label: "nb", documentaion: "Norwegian (Bokmål)" },
  { label: "nl", documentaion: "Dutch" },
  { label: "pl", documentaion: "Polish" },
  { label: "pt", documentaion: "Portuguese" },
  { label: "pt-BR", documentaion: "Portuguese (Brazil)" },
  { label: "ro", documentaion: "Romanian" },
  { label: "ru", documentaion: "Russian" },
  { label: "sv", documentaion: "Swedish" },
  { label: "th", documentaion: "Thai" },
  { label: "tr", documentaion: "Turkish" },
  { label: "uk", documentaion: "Ukrainian" },
  { label: "vi", documentaion: "Vietnamese" },
  { label: "zh", documentaion: "Chinese" },
  { label: "zh-Hans", documentaion: "Chinese (Simplified)" },
  { label: "zh-Hant", documentaion: "Chinese (Traditional)" },
];