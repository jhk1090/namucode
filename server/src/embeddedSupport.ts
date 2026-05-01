/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Connection } from 'vscode-languageserver';
import { TextDocument, Position, LanguageService, Range } from './languageModes';
import { GetDocumentSymbolFromClientRequest } from './server';

export interface LanguageRange extends Range {
	languageId: string | undefined;
	attributeValue?: boolean;
}

export interface HTMLDocumentRegions {
	getEmbeddedDocument(languageId: string, ignoreAttributeValues?: boolean): TextDocument;
	getLanguageRanges(range: Range): LanguageRange[];
	getLanguageAtPosition(position: Position): string | undefined;
	getLanguagesInDocument(): string[];
}

export const CSS_STYLE_RULE = '__';

interface EmbeddedRegion { languageId: string | undefined; start: number; end: number; attributeValue?: boolean; }

export function getDocumentRegions(document: TextDocument, documentSymbol: Record<string, any>): HTMLDocumentRegions {
	const regions: EmbeddedRegion[] = [];

	const targetDepthTypes = ["scaleText", "colorText", "wikiSyntax", "folding", "ifSyntax"]
	const targetFlatTypes = ["syntaxSyntax", "htmlSyntax", "literal", "styleSyntax"]
	const specialTypes = ["paragraph", "heading", "table", "link", "footnote", "blockquote", "indent", "list"]

	const allTypes = [...targetDepthTypes, ...targetFlatTypes, ...specialTypes]

	const findTargetTypes = (array: any[]) => {
		if (array.length === undefined) {
			findTargetTypes([array]);
			return;
		}

		for (const element of array) {
			if (!allTypes.includes(element.type)) continue

			if (targetDepthTypes.includes(element.type)) {
				const tokStartLine = element.startLine - 1;
				const tokEndLine = element.endLine - 2;
				element.content = element.content ?? [];
				if (tokStartLine < tokEndLine) {
					for (const content of element.content) {
						findTargetTypes(content);
					}
				}
				if (element.type === "wikiSyntax") {
					const startOffset = document.offsetAt({ line: tokStartLine, character: 0 })
					const targetLine = document.getText().substring(startOffset).split(/(\r)?\n/)[0];
					const syntaxStart = targetLine.indexOf("{{{#!wiki")

					const propertyRegex = /(style|dark-style|class|lang)=\"/g;
					const stylePropertyRegex = /(style|dark-style)=\"/g;
					const classPropertyRegex = /(class)=\"/g;
					const langPropertyRegex = /(lang)=\"/g;

					propertyRegex.lastIndex = syntaxStart;
					stylePropertyRegex.lastIndex = syntaxStart;
					classPropertyRegex.lastIndex = syntaxStart;
					langPropertyRegex.lastIndex = syntaxStart;

					while (true) {
						const styleStartMatch = propertyRegex.exec(targetLine);
						if (styleStartMatch) {
							let styleStart = styleStartMatch.index + styleStartMatch[0].length;

							const styleEndRegex = /\"/g;
							styleEndRegex.lastIndex = styleStart;

							const styleEndMatch = styleEndRegex.exec(targetLine);
							let styleEnd = styleEndMatch ? styleEndMatch.index + 1 : targetLine.length + 1;

							if (styleStart < styleEnd) {
								// 가장 낮은 걸 채택
								let match;
								let matchIndexPriority: number | undefined;
								let languageIdPriority = "";

								if (match = stylePropertyRegex.exec(targetLine)) {
									if (!matchIndexPriority || matchIndexPriority > match.index) {
										matchIndexPriority = match.index
										languageIdPriority = "css-inline"
									}
								}
								if (match = classPropertyRegex.exec(targetLine)) {
									if (!matchIndexPriority || matchIndexPriority > match.index) {
										matchIndexPriority = match.index
										languageIdPriority = "wiki-class"
									}
								}
								if (languageIdPriority !== "") {
									regions.push({ languageId: languageIdPriority, start: startOffset + styleStart, end: startOffset + styleEnd })
								}
							}

							propertyRegex.lastIndex = styleEnd;
							stylePropertyRegex.lastIndex = styleEnd;
							classPropertyRegex.lastIndex = styleEnd;
							langPropertyRegex.lastIndex = styleEnd;

							if (!styleEndMatch) {
								break;
							}
							continue;
						}	
						break;
					}
				}
				if (element.type === "ifSyntax") {
					const startOffset = document.offsetAt({ line: tokStartLine, character: 0 })
					const targetLine = document.getText().substring(startOffset).split(/(\r)?\n/)[0];
					const syntaxStart = targetLine.indexOf("{{{#!if ")
					const syntaxEnd = targetLine.length + 1;

					if (syntaxStart < syntaxEnd) {
						regions.push({ languageId: 'js', start: startOffset + syntaxStart, end: startOffset + syntaxEnd })
					}
				}
				continue;
			}
			if (targetFlatTypes.includes(element.type)) {
				if (element.type === "styleSyntax") {
					let { innerStartLine, endLine, innerStartColumn, innerEndColumn } = element;
					// Zero-index base
					innerStartLine -= 1
					endLine -= 1
					innerStartColumn -= 1
					innerEndColumn -= 1

					const startPosition = { line: innerStartLine, character: innerStartColumn }
					const endPosition = { line: endLine, character: innerEndColumn }
					regions.push({ languageId: 'css', start: document.offsetAt(startPosition), end: document.offsetAt(endPosition) })
				}
				continue;
			}
			if (element.type === "paragraph") {
				for (const line of element.lines ?? []) {
					findTargetTypes(line);
				}
				continue;
			}
			if (element.type === "heading") {
				// heading은 상위에서만 적용됨: startLine == 0
				findTargetTypes(element.content);
				continue;
			}
			if (element.type === "table") {
				for (const row of element.rows) {
					for (const column of row) {
						findTargetTypes(column.value ?? []);
					}
				}
				continue;
			}
			if (element.type === "link") {
				findTargetTypes(element.parsedText ?? []);
				continue;
			}
			if (element.type === "footnote") {
				findTargetTypes(element.value ?? []);
				continue;
			}
			if (element.type === "blockquote") {
          findTargetTypes(element.content ?? []);
          continue;
			}
			if (element.type === "indent") {
				findTargetTypes(element.content ?? []);
				continue;
			}
			if (element.type === "list") {
				for (const item of element.items ?? []) {
					findTargetTypes(item);
				}
				continue;
			}
		}
	};

	findTargetTypes(documentSymbol.result ?? [])

	return {
		getLanguageRanges: (range: Range) => getLanguageRanges(document, regions, range),
		getEmbeddedDocument: (languageId: string, ignoreAttributeValues: boolean) => getEmbeddedDocument(document, regions, languageId, ignoreAttributeValues),
		getLanguageAtPosition: (position: Position) => getLanguageAtPosition(document, regions, position),
		getLanguagesInDocument: () => getLanguagesInDocument(document, regions),
	};
}


function getLanguageRanges(document: TextDocument, regions: EmbeddedRegion[], range: Range): LanguageRange[] {
	const result: LanguageRange[] = [];
	let currentPos = range ? range.start : Position.create(0, 0);
	let currentOffset = range ? document.offsetAt(range.start) : 0;
	const endOffset = range ? document.offsetAt(range.end) : document.getText().length;
	for (const region of regions) {
		if (region.end > currentOffset && region.start < endOffset) {
			const start = Math.max(region.start, currentOffset);
			const startPos = document.positionAt(start);
			if (currentOffset < region.start) {
				result.push({
					start: currentPos,
					end: startPos,
					languageId: 'html'
				});
			}
			const end = Math.min(region.end, endOffset);
			const endPos = document.positionAt(end);
			if (end > region.start) {
				result.push({
					start: startPos,
					end: endPos,
					languageId: region.languageId,
					attributeValue: region.attributeValue
				});
			}
			currentOffset = end;
			currentPos = endPos;
		}
	}
	if (currentOffset < endOffset) {
		const endPos = range ? range.end : document.positionAt(endOffset);
		result.push({
			start: currentPos,
			end: endPos,
			languageId: 'html'
		});
	}
	return result;
}

function getLanguagesInDocument(_document: TextDocument, regions: EmbeddedRegion[]): string[] {
	const result = [];
	for (const region of regions) {
		if (region.languageId && result.indexOf(region.languageId) === -1) {
			result.push(region.languageId);
			if (result.length === 3) {
				return result;
			}
		}
	}
	result.push('html');
	return result;
}

function getLanguageAtPosition(document: TextDocument, regions: EmbeddedRegion[], position: Position): string | undefined {
	const offset = document.offsetAt(position);
	for (const region of regions) {
		if (region.start <= offset) {
			if (offset <= region.end) {
				return region.languageId;
			}
		} else {
			break;
		}
	}
	return 'html';
}

function getEmbeddedDocument(document: TextDocument, contents: EmbeddedRegion[], languageId: string, ignoreAttributeValues: boolean): TextDocument {
	let currentPos = 0;
	const oldContent = document.getText();
	let result = '';
	let lastSuffix = '';
	for (const c of contents) {
		if (c.languageId === languageId && (!ignoreAttributeValues || !c.attributeValue)) {
			result = substituteWithWhitespace(result, currentPos, c.start, oldContent, lastSuffix, getPrefix(c));
			result += oldContent.substring(c.start, c.end);
			currentPos = c.end;
			lastSuffix = getSuffix(c);
		}
	}
	result = substituteWithWhitespace(result, currentPos, oldContent.length, oldContent, lastSuffix, '');
	return TextDocument.create(document.uri, languageId, document.version, result);
}

function getPrefix(c: EmbeddedRegion) {
	if (c.attributeValue) {
		switch (c.languageId) {
			case 'css': return CSS_STYLE_RULE + '{';
		}
	}
	return '';
}
function getSuffix(c: EmbeddedRegion) {
	if (c.attributeValue) {
		switch (c.languageId) {
			case 'css': return '}';
			case 'javascript': return ';';
		}
	}
	return '';
}

function substituteWithWhitespace(result: string, start: number, end: number, oldContent: string, before: string, after: string) {
	let accumulatedWS = 0;
	result += before;
	for (let i = start + before.length; i < end; i++) {
		const ch = oldContent[i];
		if (ch === '\n' || ch === '\r') {
			// only write new lines, skip the whitespace
			accumulatedWS = 0;
			result += ch;
		} else {
			accumulatedWS++;
		}
	}
	result = append(result, ' ', accumulatedWS - after.length);
	result += after;
	return result;
}

function append(result: string, str: string, n: number): string {
	while (n > 0) {
		if (n & 1) {
			result += str;
		}
		n >>= 1;
		str += str;
	}
	return result;
}

function getAttributeLanguage(attributeName: string): string | null {
	const match = attributeName.match(/^(style)$|^(on\w+)$/i);
	if (!match) {
		return null;
	}
	return match[1] ? 'css' : 'javascript';
}
