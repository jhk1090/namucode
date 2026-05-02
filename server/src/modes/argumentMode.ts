/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, LanguageService as HTMLLanguageService, Position } from "../languageModes";
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts from "typescript";

export function getArgumentMode(
	htmlLanguageService: HTMLLanguageService,
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'argument';
		},
		doValidation(document: TextDocument) {
			return [];
		},
		doComplete(document: TextDocument, position: Position) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const jsRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'js');

			const allSymbols = new Map();

			jsRegions.forEach(region => {
				const symbols: string[] = [];
				const content = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end)).split("{{{#!if ")[1];
    		const sourceFile = ts.createSourceFile('virtual.js', content, ts.ScriptTarget.Latest, true);

				function delint(node: ts.Node) {
						// 선언문 (const, let, var) 처리
						if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
								symbols.push(node.name.text);
						}

						// 키워드 없는 할당문 처리 (x = 10)
						// ExpressionStatement -> BinaryExpression (left = right) 확인
						if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
								if (ts.isIdentifier(node.left)) {
										symbols.push(node.left.text);
								}
						}

						// 함수 선언문 처리
						if (ts.isFunctionDeclaration(node) && node.name) {
								symbols.push(node.name.text);
						}

						ts.forEachChild(node, delint);
				}

				delint(sourceFile);

				symbols.forEach(symbol => {
					allSymbols.set(symbol, {
						label: symbol,
						kind: 6,
						insertText: symbol + "@"
					})
				})
			});

			const inUsedRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'argument-in-used');
			
			inUsedRegions.forEach(region => {
				const symbol = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end)).split("@")[1]
				allSymbols.set(symbol, {
					label: symbol,
					kind: 6,
					insertText: symbol + "@"
				})
			})

			return {
				isIncomplete: false,
				items: Array.from(allSymbols.values())
			};
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}