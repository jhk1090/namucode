/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageService as CSSLanguageService, Diagnostic } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getCSSMode(
	cssLanguageService: CSSLanguageService,
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'css';
		},
		doValidation(document: TextDocument) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const cssRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'css');

			const allDiagnostics: Diagnostic[] = [];

			cssRegions.forEach(region => {
				const content = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end));
				
				// 좌표 유지를 위해 앞부분을 줄바꿈(\n)으로 채운 가상 문서 생성
				const prefix = document.getText().substring(0, document.offsetAt(region.start)).replace(/[^\r\n]/g, ' ');
				const virtualDoc = TextDocument.create(document.uri, 'css', document.version, prefix + content);
				
				const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
				const diagnostics = cssLanguageService.doValidation(virtualDoc, stylesheet);

				// 여기서 나오는 diagnostics는 region의 범위를 넘어서 EOF를 가질 수 없음
				allDiagnostics.push(...diagnostics);
		});

			return allDiagnostics;
		},
		doComplete(document: TextDocument, position: Position) {
			const offset = document.offsetAt(position);
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};
			
			const regions = documentRegions.getLanguageRanges(fullRange).filter(r => r.languageId === 'css');
			const currentRegion = regions.find(r => 
				offset >= document.offsetAt(r.start) && offset <= document.offsetAt(r.end)
			);

			if (!currentRegion) return null;

			const originalText = document.getText();
			const regionStart = document.offsetAt(currentRegion.start);
			const regionEnd = document.offsetAt(currentRegion.end);

			// 현재 영역 앞 뒤 공백으로 치환해 격리된 텍스트 생성
			const prefix = originalText.substring(0, regionStart).replace(/[^\r\n]/g, ' ');
			const content = originalText.substring(regionStart, regionEnd);
			let isolatedText = prefix + content;
			isolatedText = isolatedText.replace(/@theseed-dark-mode/g, '@media all and (n)')

			const isolatedDoc = TextDocument.create(document.uri, 'css', document.version, isolatedText);
  		const stylesheet = cssLanguageService.parseStylesheet(isolatedDoc);

			return cssLanguageService.doComplete(isolatedDoc, position, stylesheet)
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
