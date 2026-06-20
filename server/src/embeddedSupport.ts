/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument, Position, Range, MODES_LENGTH } from './languageModes';

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
	let regions: EmbeddedRegion[] = [];

	const ingredients = documentSymbol?.data?.embeddedRegionIngredients ?? []
	for (const ingredient of ingredients) {
    if (ingredient.type === "wikiSyntax") {
      const tokStartLine = ingredient.startLine - 1;
      const startOffset = document.offsetAt({ line: tokStartLine, character: 0 });
      const targetLine = document
        .getText()
        .substring(startOffset)
        .split(/(\r)?\n/)[0];
      const syntaxStart = targetLine.indexOf("{{{#!wiki");

      const propertyRegex = /(style|dark-style)=\"/g;
      const stylePropertyRegex = /(style|dark-style)=\"/g;

      propertyRegex.lastIndex = syntaxStart;
      stylePropertyRegex.lastIndex = syntaxStart;

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

            if ((match = stylePropertyRegex.exec(targetLine))) {
              if (!matchIndexPriority || matchIndexPriority > match.index) {
                matchIndexPriority = match.index;
                languageIdPriority = "css-inline";
              }
            }
            if (languageIdPriority !== "") {
              regions.push({ languageId: languageIdPriority, start: startOffset + styleStart, end: startOffset + styleEnd });
            }
          }

          propertyRegex.lastIndex = styleEnd;
          stylePropertyRegex.lastIndex = styleEnd;

          if (!styleEndMatch) {
            break;
          }
          continue;
        }
        break;
      }
    }
    if (ingredient.type === "ifSyntax") {
      const tokStartLine = ingredient.startLine - 1;
      const startOffset = document.offsetAt({ line: tokStartLine, character: 0 });
      const targetLine = document
        .getText()
        .substring(startOffset)
        .split(/(\r)?\n/)[0];
      const syntaxStart = targetLine.indexOf("{{{#!if ") + "{{{#!if ".length;
      const syntaxEnd = targetLine.length + 1;

      if (syntaxStart < syntaxEnd) {
        regions.push({ languageId: "js", start: startOffset + syntaxStart, end: startOffset + syntaxEnd });
      }
    }

    if (ingredient.type === "styleSyntax") {
      let { innerStartLine, endLine, innerStartColumn, innerEndColumn } = ingredient;
      // Zero-index base
      innerStartLine -= 1;
      endLine -= 1;
      innerStartColumn -= 1;
      innerEndColumn -= 1;

      const startPosition = { line: innerStartLine, character: innerStartColumn };
      const endPosition = { line: endLine, character: innerEndColumn };
      regions.push({ languageId: "css", start: document.offsetAt(startPosition), end: document.offsetAt(endPosition) });
    }
  }

	let match = undefined;

	const argumentRegex = /@([\p{L}\p{N}_]*)(=[^\n\r@]+)?@/gu
	while ((match = argumentRegex.exec(document.getText())) !== null) {
		let start = match.index;
		let end = (start + match[0].length - 1);
		regions.push({ languageId: "argument", start, end })
	}

	const wikiPropertyForCompletionRegex = /(\{\{\{#!wiki.*(style|dark-style)=")((?:(?!"|\}\}\}).)*)("|\}\}\}|$)/gm;
	while ((match = wikiPropertyForCompletionRegex.exec(document.getText())) !== null) {
		let start = match.index + match[1].length;
		let end = (start + match[3].length + 1);

		const property = match[2]
		regions.push({ languageId: `wiki-${property}-for-completion`, start, end })
	}

	regions = regions.sort((a, b) => a.start - b.start)

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
		// 매개변수는 범위 상관 없음
		if (region.languageId === "argument") {
			result.push({
				start: document.positionAt(region.start),
				end: document.positionAt(region.end),
				languageId: 'argument'
			})
			continue;
		}
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
			// modes 개수
			if (result.length === MODES_LENGTH) {
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
