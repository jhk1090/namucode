/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getWikiClassMode(
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'wiki-class';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position, options = {}) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const cssRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'css');
			const wikiClassRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'wiki-class');

			let classNameList: string[] = []

			cssRegions.forEach(region => {
				const content = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end));

				const classNameRegex = /\.([a-zA-Z0-9_-]+)(?=[^;}]*\{)/g;
				classNameList.push(...[...content.matchAll(classNameRegex)].map(match => match[1]));
			});

			const validClassNameRegex = /^([a-zA-Z0-9_-]+)$/;
			wikiClassRegions.forEach(region => {
				let wikiClassList = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end) - 1).trim().split(" ")
				wikiClassList = wikiClassList.filter(wikiClass => validClassNameRegex.exec(wikiClass))
        classNameList.push(...wikiClassList)
			})

			return {
        isIncomplete: false,
        items: Array.from(new Set(classNameList)).map((className) => ({
          label: className,
          kind: 7,
          ...(options.isOnclickCompletion
            ? {
								insertText: className + options.suffix,
                command: {
                  title: "suggest",
                  command: "editor.action.triggerSuggest",
                },
              }
            : {}),
        })),
      };
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}