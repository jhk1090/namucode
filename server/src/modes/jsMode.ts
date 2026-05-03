/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HTMLDocumentRegions } from "../embeddedSupport";
import { LanguageMode, LanguageService as HTMLLanguageService, Position, CompletionItemKind } from "../languageModes";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";

export function getJSMode(htmlLanguageService: HTMLLanguageService, documentRegions: HTMLDocumentRegions): LanguageMode {
  return {
    getId() {
      return "js";
    },
    doComplete(document: TextDocument, position: Position, isArgumentCompletion = false) {
      const allSymbols = new Map();

      const fullRange = {
        start: { line: 0, character: 0 },
        end: document.positionAt(document.getText().length)
      };
      const jsRegions = documentRegions.getLanguageRanges(fullRange)
        .filter(r => r.languageId === 'js');

      jsRegions.forEach(region => {
        const content = document.getText(region);
        
        // TypeScript AST 생성
        const sourceFile = ts.createSourceFile(
          'virtual.js',
          content,
          ts.ScriptTarget.Latest,
          true
        );

        // AST 탐색 함수
        function parseNode(node: ts.Node) {
          // 선언문 (let, const, var)
          if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
            addSymbol(node.name.text, CompletionItemKind.Variable);
          }

          // 키워드 없는 할당문 (x = 10)
          else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isIdentifier(node.left)) {
              addSymbol(node.left.text, CompletionItemKind.Variable);
            }
          }

          // 함수 선언
          else if (ts.isFunctionDeclaration(node) && node.name) {
            addSymbol(node.name.text, CompletionItemKind.Function);
          }

          ts.forEachChild(node, parseNode);
        }

        function addSymbol(name: string, kind: any) {
          if (!allSymbols.has(name)) {
            allSymbols.set(name, {
              label: name,
              kind: kind,
              insertText: isArgumentCompletion ? name + "@" : name
            });
          }
        }

        parseNode(sourceFile);
      });

			const argumentRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'argument');
			
			argumentRegions.forEach(region => {
				const name = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end)).split("@")[1].split("=")[0]
				allSymbols.set(name, {
					label: name,
					kind: CompletionItemKind.Variable,
					insertText: isArgumentCompletion ? name + "@" : name
				})
			})

      return {
        isIncomplete: false,
        items: Array.from(allSymbols.values())
      };
    },
    onDocumentRemoved() {
      /* nothing to do */
    },
    dispose() {
      /* nothing to do */
    },
  };
}
