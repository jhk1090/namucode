/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HTMLDocumentRegions } from "../embeddedSupport";
import { LanguageMode, LanguageService as HTMLLanguageService, Position } from "../languageModes";
import { TextDocument } from "vscode-languageserver-textdocument";

export function getJSMode(htmlLanguageService: HTMLLanguageService, documentRegions: HTMLDocumentRegions): LanguageMode {
  return {
    getId() {
      return "js";
    },
    doComplete(document: TextDocument, position: Position) {
			const offset = document.offsetAt(position);
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const regions = documentRegions.getLanguageRanges(fullRange).filter(r => r.languageId === 'js');
			const currentRegion = regions.find(r => 
				offset >= document.offsetAt(r.start) && offset <= document.offsetAt(r.end)
			);

			if (!currentRegion) return null;

			const originalText = document.getText();
			const regionStart = document.offsetAt(currentRegion.start);
			const regionEnd = document.offsetAt(currentRegion.end);

			const wrapperStart = "<script>";
		  const wrapperEnd = "</script>";

			// 현재 영역 앞 뒤 공백으로 치환해 격리된 텍스트 생성
			const prefix = originalText.substring(0, regionStart).replace(/[^\r\n]/g, ' ');
			const adjustedPrefix = prefix.slice(0, -wrapperStart.length) + wrapperStart;

			const content = originalText.substring(regionStart, regionEnd);

			const isolatedText = adjustedPrefix + content + wrapperEnd;
			const isolatedDoc = TextDocument.create(document.uri, 'html', document.version, isolatedText);

			const htmlScan = htmlLanguageService.parseHTMLDocument(isolatedDoc)
      return htmlLanguageService.doComplete(isolatedDoc, position, htmlScan);
    },
    onDocumentRemoved() {
      /* nothing to do */
    },
    dispose() {
      /* nothing to do */
    },
  };
}
