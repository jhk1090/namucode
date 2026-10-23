import { parserCache, diagnosticsQuery } from './parser';
import { Node } from 'web-tree-sitter';
import { CompletionItemKind, Diagnostic, DiagnosticSeverity, Position, Range, TextDocument, getCSSLanguageService } from 'vscode-css-languageservice';
import { connection, globalSettings } from './server';
import * as common from "./common";

export const cssLanguageService = getCSSLanguageService({
	customDataProviders: [
		{
			provideAtDirectives: () => [
				{
					name: '@theseed-dark-mode',
					description: '다크 모드 전용 스타일을 정의합니다.',
				}
			],
			provideProperties: () => [],
			providePseudoClasses: () => [],
			providePseudoElements: () => []
		}
	]
});

const colorBlockColorRegex = new RegExp(`^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6}|${common.CSSColorKeywords.join("|")})$`, "i");
const colorRegex = new RegExp(`^(#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|${common.CSSColorKeywords.join("|")})$`, "i");
const sizeRegex = /^\d+(?:%|px)?$/;

function makeDiagnostic(range: Range, message: string, severity: DiagnosticSeverity): Diagnostic {
	return { range, message, severity }
}

function getRangeByIndex(document: TextDocument, startIndex: number, endIndex: number) {
	const startPos = document.positionAt(startIndex);
	const endPos = document.positionAt(endIndex);

	return Range.create(startPos, endPos);
}

function getNodeRange(document: TextDocument, node: Node) {
	return getRangeByIndex(document, node.startIndex, node.endIndex);
}

function handleImplicitEnd(document: TextDocument, name: string, node: Node): Diagnostic | null {
	let character = null;
	switch (name) {
		case "argument_implicit_end": character = "@"; break;
		case "bracket_implicit_end": character = "}}}"; break;
		case "macro_implicit_end": character = ")]"; break;
		case "link_implicit_end": character = "]]"; break;
		case "footnote_implicit_end": character = "]"; break;
		case "table_row_implicit_end": character = "||"; break;
		case "table_caption_implicit_end": character = "|"; break;
		case "table_argument_implicit_end": character = ">"; break;
	}

	if (character) {
		return makeDiagnostic(getNodeRange(document, node.children.at(-1)), `종료 기호 ${character}가 누락되었습니다.`, DiagnosticSeverity.Error)
	}

	switch (name) {
		case "bold_implicit_end": character = "'''"; break;
		case "italic_implicit_end": character = "''"; break;
		case "strike_implicit_end": character = "--"; break;
		case "strike2_implicit_end": character = "~~"; break;
		case "superscript_implicit_end": character = "^^"; break;
		case "subscript_implicit_end": character = ",,"; break;
		case "underline_implicit_end": character = "__"; break;
	}

	if (character) {
		return makeDiagnostic(getNodeRange(document, node.children.at(-1)), `종료 기호 ${character}가 누락되었습니다.`, DiagnosticSeverity.Warning)
	}

	return null;
}

function handleTableArgument(document: TextDocument, node: Node): Diagnostic[] {
	const nameFieldNode = node.childForFieldName("name")
	const valueFieldNode = node.childForFieldName("value")

	if (!nameFieldNode) return []

	const nameFieldRange = getNodeRange(document, nameFieldNode);

	if (nameFieldNode.type === "table_argument_name") {
		return [makeDiagnostic(nameFieldRange, `${nameFieldNode.text}은/는 유효한 매개변수가 아닙니다.`, DiagnosticSeverity.Error)]
	}
	else if (nameFieldNode.type === "table_argument_required_value_name") {
		if (!valueFieldNode || valueFieldNode.text.length === 0) {
			return [makeDiagnostic(nameFieldRange, `${nameFieldNode.text}은/는 값이 필요한 매개변수입니다.`, DiagnosticSeverity.Error)]
		}

		const valueFieldRange = getNodeRange(document, valueFieldNode);
		
		if (common.tableArgumentsAlign.includes(nameFieldNode.text) && !common.tableArgumentValuesAlign.includes(valueFieldNode.text)) {
			return [makeDiagnostic(valueFieldRange, `${valueFieldNode.text}은/는 유효한 값이 아닙니다. 다음을 사용하세요: left, center, right`, DiagnosticSeverity.Error)]
		}
		
		if (common.tableArgumentsColor.includes(nameFieldNode.text)) {
			const [color1, color2] = valueFieldNode.text.split(",")
			if (color1 !== undefined && color1.length === 0) {
				return [makeDiagnostic(valueFieldRange, `첫 번째 색상이 입력되지 않았습니다.`, DiagnosticSeverity.Error)]
			}

			if (color1 !== undefined && !colorRegex.test(color1)) {
				const startPos = document.positionAt(valueFieldNode.startIndex);
				const endPos = document.positionAt(valueFieldNode.startIndex + color1.length);
				
				return [makeDiagnostic(Range.create(startPos, endPos), `${color1}은/는 유효한 색상이 아닙니다. 다음을 사용하세요: CSS 색상 키워드, 16진수 코드`, DiagnosticSeverity.Error)]
			}
			
			if (color2 !== undefined && color2.length === 0) {
				const startPos = document.positionAt(valueFieldNode.startIndex + color1.length + ",".length);
				const endPos = document.positionAt(valueFieldNode.startIndex + color1.length + ",".length);
				
				return [makeDiagnostic(Range.create(startPos, endPos), `두 번째 색상이 입력되지 않았습니다.`, DiagnosticSeverity.Error)]
			}
			
			if (color2 !== undefined && !colorRegex.test(color2)) {
				const startPos = document.positionAt(valueFieldNode.startIndex + color1.length + ",".length);
				const endPos = document.positionAt(valueFieldNode.startIndex + color1.length + ",".length + color2.length);
				
				return [makeDiagnostic(Range.create(startPos, endPos), `${color2}은/는 유효한 색상이 아닙니다. 다음을 사용하세요: CSS 색상 키워드, 16진수 코드`, DiagnosticSeverity.Error)]
			}

			if (
				color1 !== undefined && color2 !== undefined &&
				valueFieldNode.startIndex + color1.length + ",".length + color2.length < valueFieldNode.endIndex
			) {
				const startPos = document.positionAt(valueFieldNode.startIndex + color1.length + ",".length + color2.length);
				const endPos = document.positionAt(valueFieldNode.endIndex);

				return [makeDiagnostic(Range.create(startPos, endPos), `올바르지 않은 후행 값입니다.`, DiagnosticSeverity.Error)]
			}
		}
		
		if (common.tableArgumentsUnit.includes(nameFieldNode.text)) {
			if (!sizeRegex.test(valueFieldNode.text)) {
				return [makeDiagnostic(valueFieldRange, `${valueFieldNode.text}은/는 유효한 값이 아닙니다. 다음을 사용하세요: (number), (number)px, (number)%`, DiagnosticSeverity.Error)]
			}
		}

		if (common.tableArgumentsIf.includes(nameFieldNode.text)) {
			return common.getTSDiagnostics(document, valueFieldNode)
		}

		if (common.tableArgumentsClass.includes(nameFieldNode.text)) {
			const classRegex = /^-?[_\p{L}\p{Nl}][-\p{L}\p{Nl}\p{N}\p{M}]*$/u;
			const text = valueFieldNode.text;
			const diagnostics = [];

			let startOffset = 0;

			while (startOffset < text.length) {
				// 공백 건너뛰기
				if (text[startOffset] === " ") {
					startOffset++;
					continue;
				}

				let endOffset = text.indexOf(" ", startOffset);
				if (endOffset === -1) {
					endOffset = text.length;
				}

				const token = text.slice(startOffset, endOffset);

				if (!classRegex.test(token)) {
					const startPos = document.positionAt(
						valueFieldNode.startIndex + startOffset
					);
					const endPos = document.positionAt(
						valueFieldNode.startIndex + endOffset
					);

					diagnostics.push(
						makeDiagnostic(
							Range.create(startPos, endPos),
							`${token}은/는 올바른 클래스 형식이 아닙니다.`,
							DiagnosticSeverity.Warning
						)
					);
				}

				startOffset = endOffset;
			}

			return diagnostics;
		}
	}
	else if (nameFieldNode.type === "table_argument_no_value_name") {
		if (!valueFieldNode) return [];

		return [makeDiagnostic(nameFieldRange, `${nameFieldNode.text}은/는 값을 받지 않는 매개변수입니다.`, DiagnosticSeverity.Error)]
	}

	return [];
}
 
function handleWikiBlockHeader(document: TextDocument, node: Node): Diagnostic[] {
	const result = []

	if (node.children.find(child => child.type === "argument")) return result;

	const regex = /(style|dark-style|lang|class|tag|onclick)="([^"]*)(")?/g;

	const matches = [...node.text.matchAll(regex)].map(match => ({
			name: match[1],
			value: match[2],
			endToken: match[3],
			startIndex: node.startIndex + match.index,
			endIndex: node.startIndex + match.index + match[0].length,
			valueStartIndex: node.startIndex + match.index! + `${match[1]}="`.length,
	}));

	const counts = new Map();

	for (const match of matches) {
		if (!match.endToken) {
			result.push(makeDiagnostic(getRangeByIndex(document, match.endIndex, match.endIndex), `종료 기호 "가 누락되었습니다.`, DiagnosticSeverity.Error))
		}
		if (match.name === "style" || match.name === "dark-style") {
			const prefix = ".i{"
			const suffix = "}"
			const virtualText = `${prefix}${match.value}${suffix}`
			const virtualDoc = TextDocument.create(
				'namucode-virtual://embedded.css',
				'css',
				document.version,
				virtualText
			);

			const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
			const cssDiagnostics = cssLanguageService.doValidation(virtualDoc, stylesheet);

			const offset = match.startIndex + match.name.length + "=\"".length
			result.push(...cssDiagnostics
				.filter(diagnostic => {
					const start = virtualDoc.offsetAt(diagnostic.range.start);

					return start >= prefix.length
				})
				.map(diagnostic => {
					const start = virtualDoc.offsetAt(diagnostic.range.start);
					const end = virtualDoc.offsetAt(diagnostic.range.end);

					return makeDiagnostic(
						Range.create(
							document.positionAt(offset + start - prefix.length),
							document.positionAt(offset + end - prefix.length)
						),
						diagnostic.message,
						diagnostic.severity
					)
				})
			)
		}
		if (match.name === "class") {
			const classRegex = /^-?[_\p{L}\p{Nl}][-\p{L}\p{Nl}\p{N}\p{M}]*$/u;
			const text = match.value;

			let startOffset = 0;

			while (startOffset < text.length) {
				// 공백 건너뛰기
				if (text[startOffset] === " ") {
					startOffset++;
					continue;
				}

				let endOffset = text.indexOf(" ", startOffset);
				if (endOffset === -1) {
					endOffset = text.length;
				}

				const token = text.slice(startOffset, endOffset);

				if (!classRegex.test(token)) {
					const startPos = document.positionAt(
						match.valueStartIndex + startOffset
					);
					const endPos = document.positionAt(
						match.valueStartIndex + endOffset
					);

					result.push(
						makeDiagnostic(
							Range.create(startPos, endPos),
							`${token}은/는 올바른 클래스 형식이 아닙니다.`,
							DiagnosticSeverity.Warning
						)
					);
				}

				startOffset = endOffset;
			}
		}
		if (match.name === "lang") {
			const startPos = document.positionAt(match.valueStartIndex);
			const endPos = document.positionAt(match.endIndex);

			if (match.value.length > 0) {
				try {
					Intl.getCanonicalLocales(match.value)
				} catch {
					result.push(makeDiagnostic(Range.create(startPos, endPos), `${match.value}은/는 올바른 언어 코드가 아닙니다.`, DiagnosticSeverity.Warning))
				}
			}
		}
		if (match.name === "tag") {
			const startPos = document.positionAt(match.valueStartIndex);
			const endPos = document.positionAt(match.endIndex);

			if (match.value.length > 0 && !common.wikiBlockTagAttributes.includes(match.value)) {
				result.push(makeDiagnostic(Range.create(startPos, endPos), `${match.value}은/는 허용되는 HTML 태그가 아닙니다. 허용 태그: ${common.wikiBlockTagAttributes.join(", ")}`, DiagnosticSeverity.Warning))
			}
		}
		if (match.name === "onclick") {
			const classRegex = /^-?[_\p{L}\p{Nl}][-\p{L}\p{Nl}\p{N}\p{M}]*$/u;
			const allowedFunctions = ["add-class", "remove-class", "toggle-class"]
			const text = match.value;

			let startOffset = 0;
			let currentCommaCount = 0;
			let currentType = "function";

			while (startOffset < text.length) {
				// 공백 건너뛰기
				if (text[startOffset] === ",") {
					if (text[startOffset - 1] === undefined) {
						const startPos = document.positionAt(match.valueStartIndex + startOffset);
						const endPos = document.positionAt(match.valueStartIndex + startOffset + 1);
						result.push(
							makeDiagnostic(
								Range.create(startPos, endPos),
								`함수가 누락되었습니다. 허용 함수: ${allowedFunctions.join(", ")}`,
								DiagnosticSeverity.Warning
							)
						);
					}
					if (text[startOffset + 1] === "," || text[startOffset + 1] === ";") {
						const startPos = document.positionAt(match.valueStartIndex + startOffset);
						const endPos = document.positionAt(match.valueStartIndex + startOffset + 1);
						result.push(
							makeDiagnostic(
								Range.create(startPos, endPos),
								`클래스 매개변수는 빈 값이 올 수 없습니다.`,
								DiagnosticSeverity.Warning
							)
						);
					}

					currentType = "class"
					currentCommaCount++;
					startOffset++;
					continue;
				}
				if (text[startOffset] === ";") {
					if (text[startOffset + 1] === "," || text[startOffset + 1] === ";") {
						const startPos = document.positionAt(match.valueStartIndex + startOffset);
						const endPos = document.positionAt(match.valueStartIndex + startOffset + 1);
						result.push(
							makeDiagnostic(
								Range.create(startPos, endPos),
								`함수가 누락되었습니다. 허용 함수: ${allowedFunctions.join(", ")}`,
								DiagnosticSeverity.Warning
							)
						);
					}
					if (currentCommaCount < 2) {
						const startPos = document.positionAt(match.valueStartIndex + startOffset);
						const endPos = document.positionAt(match.valueStartIndex + startOffset + 1);
						result.push(
							makeDiagnostic(
								Range.create(startPos, endPos),
								`함수의 클래스 매개변수는 2개여야 합니다.`,
								DiagnosticSeverity.Warning
							)
						);
					}

					currentType = "function"
					currentCommaCount = 0;
					startOffset++;
					continue;
				}

				const nextCommaIndex = text.indexOf(",", startOffset);
				const nextSemicolonIndex = text.indexOf(";", startOffset)

				let endOffset = 0;
				if (nextCommaIndex === -1 && nextSemicolonIndex === -1) {
					endOffset = text.length;
				} else if (nextCommaIndex === -1) {
					endOffset = nextSemicolonIndex;
				} else if (nextSemicolonIndex === -1) {
					endOffset = nextCommaIndex;
				} else {
					endOffset = Math.min(nextCommaIndex, nextSemicolonIndex)
				}

				const token = text.slice(startOffset, endOffset);

				if (currentType === "class" && !classRegex.test(token.trim())) {
					const startPos = document.positionAt(match.valueStartIndex + startOffset);
					const endPos = document.positionAt(match.valueStartIndex + endOffset);
					result.push(
						makeDiagnostic(
							Range.create(startPos, endPos),
							`${token.trim()}은/는 올바른 클래스 형식이 아닙니다.`,
							DiagnosticSeverity.Warning
						)
					);
				}
				if (currentType === "class" && currentCommaCount > 2) {
					const startPos = document.positionAt(match.valueStartIndex + startOffset - 1);
					const endPos = document.positionAt(match.valueStartIndex + endOffset);
					result.push(
						makeDiagnostic(
							Range.create(startPos, endPos),
							`함수의 클래스 매개변수는 2개여야 합니다.`,
							DiagnosticSeverity.Warning
						)
					);
				}
				if (currentType === "function" && !allowedFunctions.includes(token.trim())) {
					const startPos = document.positionAt(match.valueStartIndex + startOffset);
					const endPos = document.positionAt(match.valueStartIndex + endOffset);
					result.push(
						makeDiagnostic(
							Range.create(startPos, endPos),
							`${token.trim()}은/는 올바른 함수가 아닙니다. 허용 함수: ${allowedFunctions.join(", ")}`,
							DiagnosticSeverity.Warning
						)
					);
				}

				startOffset = endOffset;
			}
		}
		counts.set(match.name, (counts.get(match.name) || 0) + 1);
	}

	const duplicates = matches.filter(item => counts.get(item.name) > 1);

	for (const duplicate of duplicates) {
		result.push(makeDiagnostic(getRangeByIndex(document, duplicate.startIndex, duplicate.startIndex + duplicate.name.length), `${duplicate.name}은/는 중복된 속성입니다. 선행 속성이 우선적으로 적용됩니다.`, DiagnosticSeverity.Warning))
	}

	return result;
}

function handleColorFallbackBlock(document: TextDocument, node: Node): Diagnostic | null {
	const target = node.text.slice(3, -3);
	const [color1, color2] = target.split("\n")[0].split(" ")[0].split(",")

	let offset = node.startIndex + "{{{".length;
	if (color1 !== undefined && color1.length === 0) {
		const startPos = document.positionAt(offset);
		const endPos = document.positionAt(offset + color1.length);

		return makeDiagnostic(Range.create(startPos, endPos), `첫 번째 색상이 입력되지 않았습니다.`, DiagnosticSeverity.Warning)
	}

	offset += color1.length;

	if (color1 !== undefined && !colorBlockColorRegex.test(color1)) {
		const startPos = document.positionAt(offset);
		const endPos = document.positionAt(offset);

		return makeDiagnostic(Range.create(startPos, endPos), `${color1}은/는 유효한 색상이 아닙니다. 다음을 사용하세요: CSS 색상 키워드, 16진수 코드`, DiagnosticSeverity.Warning)
	}

	if (color2 !== undefined && color2.length === 0) {
		const startPos = document.positionAt(offset + ",".length);
		const endPos = document.positionAt(offset + ",".length);
		
		return makeDiagnostic(Range.create(startPos, endPos), `두 번째 색상이 입력되지 않았습니다.`, DiagnosticSeverity.Warning)
	}

	offset += ",".length
	
	if (color2 !== undefined && !colorBlockColorRegex.test(color2)) {
		const startPos = document.positionAt(offset);
		const endPos = document.positionAt(offset + color2.length);
		
		return makeDiagnostic(Range.create(startPos, endPos), `${color2}은/는 유효한 색상이 아닙니다. 다음을 사용하세요: CSS 색상 키워드, 16진수 코드`, DiagnosticSeverity.Warning)
	}

	const separator = node.text[offset]
	if (separator != " " && separator != "\r" && separator != "\n") {
		const range = getNodeRange(document, node);
		return makeDiagnostic(range, `색상 다음에는 반드시 공백 또는 줄바꿈이 와야 합니다.`, DiagnosticSeverity.Warning)
	}

	return null;
}

function handleFileLinkAttribute(document: TextDocument, text: string, startIndex: number): Diagnostic | null {
	const endIndex = startIndex + text.length;
	const nodeRange = getRangeByIndex(document, startIndex, endIndex)

	const equalIndex = text.indexOf("=");
	if (equalIndex === -1) {
		if (text.length === 0) {
			return makeDiagnostic(nodeRange, `속성명이 비었습니다.`, DiagnosticSeverity.Warning)
		}

		if (!common.fileLinkPropertyNames.includes(text)) {
			return makeDiagnostic(nodeRange, `${text}은/는 유효한 속성명이 아닙니다.`, DiagnosticSeverity.Warning)
		}

		return makeDiagnostic(nodeRange, "값이 입력되지 않았습니다.", DiagnosticSeverity.Warning)
	}

	const [name, ...rest] = text.split("=");
	const value = rest.join("=")

	const nameStartIndex = startIndex;
	const nameEndIndex = startIndex + equalIndex;
	const nameRange = getRangeByIndex(document, nameStartIndex, nameEndIndex)

	const valueStartIndex = startIndex + equalIndex + 1
	const valueEndIndex = endIndex
	const valueRange = getRangeByIndex(document, valueStartIndex, valueEndIndex)

	if (name.length === 0) {
		return makeDiagnostic(nameRange, `속성명이 비었습니다.`, DiagnosticSeverity.Warning)
	}

	if (!common.fileLinkPropertyNames.includes(name)) {
		return makeDiagnostic(nameRange, `${name}은/는 유효한 속성명이 아닙니다.`, DiagnosticSeverity.Warning)
	}

	if (value.length === 0) {
		return makeDiagnostic(valueRange, "값이 입력되지 않았습니다.", DiagnosticSeverity.Warning)
	}

	if (["align", "object-fit", "rendering", "theme"].includes(name) && !common.fileLinkPropertyValues[name].includes(value)) {
		return makeDiagnostic(valueRange, `${value}은/는 유효한 값이 아닙니다. 다음을 사용하세요: ${common.fileLinkPropertyValues[name].join(", ")}`, DiagnosticSeverity.Warning)
	}
	
	if (name === "bgcolor" && !colorRegex.test(value)) {
		return makeDiagnostic(valueRange, `${value}은/는 유효한 색상이 아닙니다. 다음을 사용하세요: CSS 색상 키워드, 16진수 코드`, DiagnosticSeverity.Warning)
	}
	
	if (["border-radius", "height", "width"].includes(name) && !sizeRegex.test(value)) {
		return makeDiagnostic(valueRange, `${value}은/는 유효한 값이 아닙니다. 다음을 사용하세요: (number), (number)px, (number)%`, DiagnosticSeverity.Warning)
	}

	return null;
}

export function updateDiagnostics(document: TextDocument) {
	const diagnostics: Diagnostic[] = [];

	if (globalSettings.disableCodeAnalysis) {
		connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
		return;
	}
	
	const tree = parserCache.get(document.uri.toString())?.tree;
	if (!tree) {
		connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
		return;
	}

	for (const { name, node } of diagnosticsQuery.captures(tree.rootNode)) {
		if (name.endsWith("_implicit_end")) {
			const result = handleImplicitEnd(document, name, node);
			if (result) diagnostics.push(result)	
		}
		else if (name === "horizontal_line_implicit") {
			const range = getNodeRange(document, node);
			diagnostics.push(makeDiagnostic(range, `수평줄의 길이는 4~9자여야 합니다.`, DiagnosticSeverity.Error))
		}
		else if (name === "table_argument") {
			diagnostics.push(...handleTableArgument(document, node))
		}
		else if (name === "if_block_header") {
			diagnostics.push(...common.getTSDiagnostics(document, node))
		}
		else if (name === "wiki_block_header") {
			if (node.children.find(child => child.type === "argument")) continue;
			diagnostics.push(...handleWikiBlockHeader(document, node))
		}
		else if (name === "macro_without_args") {
			const range = getNodeRange(document, node);
			if (common.macrosArgumentRequired.includes(node.text.slice(1, -1))) {
				diagnostics.push(makeDiagnostic(range, `'${node.text.slice(1, -1)}' 매크로는 매개변수가 1개 이상 필요합니다.`, DiagnosticSeverity.Warning))
			}
		}
		else if (name === "macro") {
			if (node.children[1].type === "no_arg_macro_name") {
				const range = getNodeRange(document, node);
				diagnostics.push(makeDiagnostic(range, `'${node.children[1].text}' 매크로는 매개변수를 받지 않습니다.`, DiagnosticSeverity.Warning))
			}
			else if (node.children[1].type === "required_arg_macro_name" && !node.children.find(child => child.type === "macro_content")) {
				const range = getNodeRange(document, node);
				diagnostics.push(makeDiagnostic(range, `'${node.children[1].text}' 매크로는 매개변수가 1개 이상 필요합니다.`, DiagnosticSeverity.Warning))
			}
		}
		else if (name === "style_block_content") {
			if (node.children.find(child => child.type === "argument")) continue;
			
			let virtualText = `${node.text}`
			virtualText = virtualText.replace(/@theseed-dark-mode/g, '@media all and (n)')
			const virtualDoc = TextDocument.create(
				'namucode-virtual://embedded.css',
				'css',
				document.version,
				virtualText
			);

			const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
			const cssDiagnostics = cssLanguageService.doValidation(virtualDoc, stylesheet);

			diagnostics.push(...cssDiagnostics
				.map(diagnostic => {
					const start = virtualDoc.offsetAt(diagnostic.range.start);
					const end = virtualDoc.offsetAt(diagnostic.range.end);

					return makeDiagnostic(
						Range.create(
							document.positionAt(node.startIndex + start),
							document.positionAt(node.startIndex + end)
						),
						diagnostic.message,
						diagnostic.severity
					)
				})
			)
		}
		else if (name === "if_fallback_block") {
			const range = getNodeRange(document, node);

			let message = "";
			if (node.text.indexOf("\n") != -1) {
				message = "#!if 다음에는 반드시 최소 한 개의 공백이 와야합니다."
			} else {
				message = "줄바꿈이 필요합니다."
			}

			diagnostics.push(makeDiagnostic(range, message, DiagnosticSeverity.Warning))
		}
		else if (name === "folding_fallback_block" || name === "wiki_fallback_block") {
			const range = getNodeRange(document, node);

			let message = "";
			if (node.text.indexOf("\n") != -1) {
				const type = name.split("_fallback_block")[0]
				message = `#!${type} 다음에는 반드시 최소 한 개의 공백 또는 줄바꿈이 와야 합니다.`
			} else {
				message = "줄바꿈이 필요합니다."
			}
			diagnostics.push(makeDiagnostic(range, message, DiagnosticSeverity.Warning))
		}
		else if (name === "syntax_fallback_block") {
			const range = getNodeRange(document, node);
			
			let message = "";
			if (node.text.indexOf("\n") != -1) {
				const language = node.text.slice(11).split(/\r?\n/)[0].slice(1)
				message = `'${language}'은/는 유효한 언어가 아닙니다.`
			} else {
				message = "줄바꿈이 필요합니다."
			}

			diagnostics.push(makeDiagnostic(range, message, DiagnosticSeverity.Warning))
		}
		else if (name === "style_fallback_block" || name === "latex_fallback_block") {
			const range = getNodeRange(document, node);

			let message = ""
			if (node.text.indexOf("\n") != -1) {
				const type = name.split("_fallback_block")[0]
				message = `#!${type} 다음에는 반드시 줄바꿈이 와야 합니다.`
			} else {
				message = "줄바꿈이 필요합니다."
			}
			diagnostics.push(makeDiagnostic(range, message, DiagnosticSeverity.Warning))
		}
		else if (name === "scale_fallback_block") {
			const range = getNodeRange(document, node);
			const target = node.text.slice(3, 5);
			const size = parseInt(target[1])
			
			if (!isNaN(size)) {
				if (size >= 1 && size <= 5) {
					diagnostics.push(makeDiagnostic(range, `${target} 다음에는 반드시 공백 또는 줄바꿈이 와야 합니다.`, DiagnosticSeverity.Warning))
				} else {
					diagnostics.push(makeDiagnostic(range, "크기는 1 이상 5 이하여야 합니다.", DiagnosticSeverity.Warning))	
				}
			}
		}
		else if (name === "color_fallback_block") {
			const result = handleColorFallbackBlock(document, node);
			if (result) diagnostics.push(result)
		}
		else if (name === "file_link_attribute") {
			if (node.children.find(child => child.type === "argument")) continue;

			let index = node.startIndex;

			for (const attribute of node.text.split("&")) {
				const result = handleFileLinkAttribute(document, attribute, index)
				if (result) diagnostics.push(result)

				index += attribute.length + 1;
			}
		}
	}

	connection.sendDiagnostics({ uri: document.uri, diagnostics });
}