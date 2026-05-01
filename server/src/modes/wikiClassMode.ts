/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageService as CSSLanguageService, Diagnostic, Stylesheet } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getWikiClassMode(
	cssLanguageService: CSSLanguageService,
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'wiki-class';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const cssRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'css');

			let names: string[] = []

			cssRegions.forEach(region => {
				const content = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end));
				
				// 좌표 유지를 위해 앞부분을 줄바꿈(\n)으로 채운 가상 문서 생성
				const prefix = document.getText().substring(0, document.offsetAt(region.start)).replace(/[^\r\n]/g, ' ');

				let virtualText = prefix + content
				virtualText = virtualText.replace(/@(.+)@/g, "  $1");

				const virtualDoc = TextDocument.create(document.uri, 'css', document.version, virtualText);
				
				const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
				names = getAllClassNames(virtualDoc, stylesheet);
			});

			return {
				isIncomplete: false,
				items: names.map(name => ({
					label: name,
					kind: 7
				}))
			};
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}


function getAllClassNames(document: TextDocument, stylesheet: Stylesheet): string[] {
  const classNames = new Set();

  // AST 노드를 재귀적으로 방문하는 함수
  function visit(node: any) {
    if (node.type === 5) { // 5는 ClassSelector를 의미 (cssLanguageService 내부 상수)
      const text = document.getText();
      // .className 에서 '.'을 제외한 이름만 추출
      const name = text.substring(node.offset + 1, node.offset + node.length);
      classNames.add(name);
    }
    if (node.children) {
      node.children.forEach(visit);
    }
  }

  visit(stylesheet);
  return Array.from(classNames) as string[];
}