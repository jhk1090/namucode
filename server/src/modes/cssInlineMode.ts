/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageService as CSSLanguageService, Diagnostic } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getCSSInlineMode(
	cssLanguageService: CSSLanguageService,
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'css-inline';
		},
		doValidation(document: TextDocument) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const cssRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'css-inline');

			const allDiagnostics: Diagnostic[] = [];

			cssRegions.forEach(region => {
				const regionStartOffset = document.offsetAt(region.start);
				const regionEndOffset = document.offsetAt(region.end);
				const content = document.getText().substring(regionStartOffset, regionEndOffset);
				
				// 좌표 유지를 위해 앞부분을 줄바꿈(\n)으로 채운 가상 문서 생성
				const prefix = document.getText().substring(0, document.offsetAt(region.start)).replace(/[^\r\n]/g, ' ');

				const wrapperStart = ".i{"
				const wrapperEnd = "}";

				const adjustedPrefix = prefix.slice(0, -wrapperStart.length) + wrapperStart;

				let virtualText = adjustedPrefix + content + wrapperEnd;
				virtualText = virtualText.replace(/@(.+)@/g, "  $1");

				const virtualDoc = TextDocument.create(document.uri, 'css', document.version, virtualText);
				
				const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
				const diagnostics = cssLanguageService.doValidation(virtualDoc, stylesheet);

				const filtered = diagnostics.filter(d => {
					const dStart = virtualDoc.offsetAt(d.range.start);
					const dEnd = virtualDoc.offsetAt(d.range.end);
				
					// 가상으로 넣은 '.i{'와 '}' 영역에서 발생한 에러는 무시하고,
					// 오직 실제 content 범위 내의 에러만 수집합니다.
					return dStart >= regionStartOffset && dEnd <= regionEndOffset;
				});

				// 여기서 나오는 diagnostics는 region의 범위를 넘어서 EOF를 가질 수 없음
				allDiagnostics.push(...filtered);
		});

			return allDiagnostics;
		},
		doComplete(document: TextDocument, position: Position) {
			const offset = document.offsetAt(position);
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};
			
			const regions = documentRegions.getLanguageRanges(fullRange).filter(r => r.languageId === 'css-inline');
			const currentRegion = regions.find(r => 
				offset >= document.offsetAt(r.start) && offset <= document.offsetAt(r.end)
			);

			if (!currentRegion) return null;

			const originalText = document.getText();
			const regionStart = document.offsetAt(currentRegion.start);
			const regionEnd = document.offsetAt(currentRegion.end);

			const wrapperStart = ".i{";
		  const wrapperEnd = "}";

			// 현재 영역 앞 뒤 공백으로 치환해 격리된 텍스트 생성
			const prefix = originalText.substring(0, regionStart).replace(/[^\r\n]/g, ' ');
			const adjustedPrefix = prefix.slice(0, -wrapperStart.length) + wrapperStart;

			const content = originalText.substring(regionStart, regionEnd);

			let isolatedText = adjustedPrefix + content + wrapperEnd;
			isolatedText = isolatedText.replace(/@(.+)@/g, "  $1");

			const isolatedDoc = TextDocument.create(document.uri, 'css', document.version, isolatedText);
  		const stylesheet = cssLanguageService.parseStylesheet(isolatedDoc);

			return cssLanguageService.doComplete(isolatedDoc, position, stylesheet);
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
