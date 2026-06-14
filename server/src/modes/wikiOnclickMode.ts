/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItemKind } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { languageModes } from '../server';

export function getWikiOnclickMode(documentRegions: HTMLDocumentRegions): LanguageMode {
	return {
		getId() {
			return 'wiki-onclick';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position) {
			const offset = document.offsetAt(position);
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};
			
			const regions = documentRegions.getLanguageRanges(fullRange).filter(r => r.languageId === 'wiki-onclick');
			const currentRegion = regions.find(r => 
				offset >= document.offsetAt(r.start) && offset <= document.offsetAt(r.end)
			);

			if (!currentRegion) return null;

			const originalText = document.getText();
			const regionStart = document.offsetAt(currentRegion.start);
			const regionEnd = document.offsetAt(currentRegion.end);
			const content = originalText.substring(regionStart, regionEnd - 1);

			const lastPart = content.split(";").pop().trim();
			const commaCount = (lastPart.match(/,/g) || []).length;

      if (commaCount <= 2 && content.trim().endsWith(",")) {
        return languageModes.getMode("wiki-class").doComplete(document, position, { isOnclickCompletion: true, suffix: commaCount === 2 ? ";" : "," });
      } else {
        return {
          isIncomplete: false,
          items: keywords.map((keyword) => ({
            label: keyword.label,
            kind: CompletionItemKind.Enum,
            insertText: keyword.label + ",",
            documentation: keyword.documentaion,
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          })),
        };
      }
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}

const keywords = [
  { label: "add-class", documentaion: "대상 클래스의 클래스 추가" },
  { label: "remove-class", documentaion: "대상 클래스의 클래스 삭제" },
  { label: "toggle-class", documentaion: "대상 클래스의 클래스 토글" },
];