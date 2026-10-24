import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionContext, CompletionItem, CompletionItemKind, CompletionList, CompletionTriggerKind, InsertTextFormat, Range } from 'vscode-languageserver/node';
import { parserCache, classCompletionQuery, jsCompletionQuery } from './parser';
import { cssLanguageService } from './diagnostics';
import * as common from './common';
import * as ts from "typescript";

const classSymbols = new Set<string>();

export function registerClassSymbols(document: TextDocument) {
	const tree = parserCache.get(document.uri.toString())?.tree;
	if (!tree) return [];

	classSymbols.clear()

	const classRegex = /^-?[_\p{L}\p{Nl}][-\p{L}\p{Nl}\p{N}\p{M}]*$/u
	for (const { name, node } of classCompletionQuery.captures(tree.rootNode)) {
		if (name === "table_argument_class_value") {
			node.text
        .split(" ")
        .filter((item) => classRegex.test(item))
        .forEach((item) => classSymbols.add(item));
		}
		else if (name === "wiki_block_header") {
			const regex = /(style|dark-style|lang|class|tag|onclick)="([^"]*)(")?/g;

			const matches = [...node.text.matchAll(regex)].map(match => ({
					name: match[1],
					value: match[2]
			}));

			const tableClassValues = matches.filter(match => match.name === "class").map(match => match.value)
			tableClassValues.forEach(value => {
				value
					.split(" ")
					.filter((item) => classRegex.test(item))
					.forEach((item) => classSymbols.add(item))
			})

			const onclickClassRegex = /(?:^|(?<=;))(?:add-class|remove-class|toggle-class),([^,;]+),([^,;]+)(?=;|$)/g;
			const tableOnclickValues = matches.filter(match => match.name === "onclick").map(match => match.value)
			tableOnclickValues.forEach(value => {
				[...value.matchAll(onclickClassRegex)]
					.map(match => [match[1].trim(), match[2].trim()])
					.flat()
					.filter((item) => classRegex.test(item))
					.forEach((item) => classSymbols.add(item))
			})
		}
		else if (name === "style_block_content") {
			const styleClassNameRegex = /\.(-?[_\p{L}\p{Nl}][-\p{L}\p{Nl}\p{N}\p{M}]*)(?=[^;}]*\{)/gu;
			[...node.text.matchAll(styleClassNameRegex)]
				.map(match => match[1])
				.forEach(item => classSymbols.add(item))
		}
	}
}

function parseNode(node: ts.Node) {
	if (
		ts.isBinaryExpression(node) &&
		node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
		ts.isIdentifier(node.left)
	) {
		common.allTSVariables.add(node.left.text);
	}

	ts.forEachChild(node, parseNode);
}

export function registerJSSymbols(document: TextDocument) {
	const tree = parserCache.get(document.uri.toString())?.tree;
	if (!tree) return [];

	common.allTSVariables.clear()

	for (const { name, node } of jsCompletionQuery.captures(tree.rootNode)) {
		if (name === "if_block_header" || name == "table_argument_rowif_value") {
			const sourceFile = ts.createSourceFile(
					"virtual.js",
					node.text,
					ts.ScriptTarget.Latest,
					true
			);
		
			parseNode(sourceFile);
		}
		else {
			common.allTSVariables.add(node.text)
		}
	}
}

export function provideCompletion(document: TextDocument, position: Position, context: CompletionContext): CompletionList | CompletionItem[] {
	const tree = parserCache.get(document.uri.toString())?.tree;
	if (!tree) return [];

	const positionIndex = document.offsetAt(position);
	const node = tree.rootNode.descendantForIndex(positionIndex);
	if (!node) return []

	const line = document.getText({ start: { line: position.line, character: 0 }, end: position });
	
	const argumentHeadRegex = /@[\p{L}\p{N}\p{M}_]*$/u;
	if (argumentHeadRegex.test(line)) {
		return common.getTSCompletions("", true)
	}

	if (
		(node.type === "wiki_block" || (node.type === "block_header" && node.parent?.type === "wiki_block")) ||
	 	(node.type === "wiki_fallback_block" || node.parent?.type === "wiki_fallback_block") ||
	 	(node.type === "wiki_fallback_block_inline" || node.parent?.type === "wiki_fallback_block_inline")
	) {
		const startIndex = line.indexOf("{{{#!wiki ");
		const quoteRegex = /"/g;
		if (startIndex !== -1) {
			quoteRegex.lastIndex = startIndex;
			const quoteCount = (line.match(quoteRegex) || []).length;
			const lastBlankIndex = line.lastIndexOf(" ");
			if (quoteCount % 2 === 0) {
				const documentations = {
					"style": "CSS 스타일 속성",
					"dark-style": "CSS 스타일 속성 (다크 모드)",
					"class": "CSS 클래스 속성",
					"lang": "언어 속성 (BCP 47)",
					"onclick": "클릭 이벤트 속성",
					"tag": "HTML 태그 속성",
				};

				return ["style", "dark-style", "class", "lang", "onclick", "tag"].map(property => ({
					label: property,
					kind: CompletionItemKind.Property,
					insertText: property + '="${0}"',
					insertTextFormat: InsertTextFormat.Snippet,
					documentation: documentations[property],
					textEdit: {
						range: {
								start: { line: position.line, character: lastBlankIndex + 1 },
								end: { line: position.line, character: position.character }
						},
						newText: property + '="${0}"',
					},
					command: {
						title: "suggest",
						command: "editor.action.triggerSuggest"
					}
				}))
			}
		}
	}

	if (
		(node.type === "block_header" && node.parent?.type === "wiki_block") ||
	 	(node.type === "nowiki_content" && node.parent?.type === "wiki_fallback_block") ||
		(node.type === "nowiki_content_inline" && node.parent?.type === "wiki_fallback_block_inline")
	) {
		const regex = /(style|dark-style|lang|class|tag|onclick)="([^"]*)(")?/g;

		const matches = [...node.text.split(/\r?\n/)[0].matchAll(regex)].map(match => ({
				name: match[1],
				value: match[2],
				endToken: match[3],
				startIndex: node.startIndex + match.index,
				endIndex: node.startIndex + match.index + match[0].length,
				valueStartIndex: node.startIndex + match.index! + `${match[1]}="`.length,
		}));

		const targetMatch = matches.find(match => match.startIndex <= positionIndex && positionIndex <= match.endIndex);
		if (!targetMatch) return [];

		if (targetMatch.name === "style" || targetMatch.name === "dark-style") {
			const prefix = ".i{"
			const suffix = "}"
			const virtualText = `${prefix}${targetMatch.value}${suffix}`
			const virtualDoc = TextDocument.create(
				'namucode-virtual://embedded.css',
				'css',
				document.version,
				virtualText
			);
	
			const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
			const relativeOffset = positionIndex - targetMatch.valueStartIndex + prefix.length;
			const virtualPosition = virtualDoc.positionAt(
					Math.max(0, Math.min(relativeOffset, virtualText.length))
			);
	
			const result = cssLanguageService.doComplete(virtualDoc, virtualPosition, stylesheet);
	
			for (const item of result.items) {
				const edit = item.textEdit;
	
				if (edit && "range" in edit) {
					const start = virtualDoc.offsetAt(edit.range.start)
					const end = virtualDoc.offsetAt(edit.range.end)
	
					item.textEdit = {
						range: {
							start: document.positionAt(targetMatch.valueStartIndex + start - prefix.length),
							end: document.positionAt(targetMatch.valueStartIndex + end  - prefix.length)
						},
						newText: edit.newText
					}
				}
			}
	
			return result;
		}
		else if (targetMatch.name === "class") {
			return [...classSymbols].map(className => ({
				label: className,
				kind: CompletionItemKind.Variable,
				textEdit: {
					range: {
						start: { 
							line: position.line, 
							character: position.character - (targetMatch.value.length - targetMatch.value.lastIndexOf(" ") - 1)
						},
						end: { line: position.line, character: position.character }
					},
					newText: className
				}
			}))
		}
		else if (targetMatch.name === "lang") {
			return common.wikiBlockLangAttributes.map(language => ({
				label: language.label,
				documentation: language.documentaion,
				textEdit: {
					range: {
						start: document.positionAt(targetMatch.valueStartIndex),
						end: { line: position.line, character: position.character }
					},
					newText: language.label
				}
			}))
		}
		else if (targetMatch.name === "tag") {
			return common.wikiBlockTagAttributes.map(tag => ({
				label: tag,
				textEdit: {
					range: {
						start: document.positionAt(targetMatch.valueStartIndex),
						end: { line: position.line, character: position.character }
					},
					newText: tag
				}
			}))
		}
		else if (targetMatch.name === "onclick") {
			const offset = document.offsetAt(position) - targetMatch.valueStartIndex;
			const text = targetMatch.value.slice(0, offset);

			// 현재 항목의 시작: 직전 , 또는 ; 다음
			const lastComma = text.lastIndexOf(",", offset - 1);
			const lastSemicolon = text.lastIndexOf(";", offset - 1);

			const startOffset = Math.max(lastComma, lastSemicolon) + 1;

			// 현재 항목의 끝: 다음 , 또는 ; 중 가장 가까운 것
			const nextComma = text.indexOf(",", offset);
			const nextSemicolon = text.indexOf(";", offset);

			const endCandidates = [nextComma, nextSemicolon].filter(i => i !== -1);
			const endOffset = endCandidates.length > 0
				? Math.min(...endCandidates)
				: text.length;

			const range = Range.create(
				document.positionAt(targetMatch.valueStartIndex + startOffset),
				document.positionAt(targetMatch.valueStartIndex + endOffset)
			);

			const lastPart = text.split(";").pop()!.trim();
			const commaCount = (lastPart.match(/,/g) || []).length;

			if (text.trim().endsWith(";") || text.trim().length === 0 || commaCount === 0) {
				return [
					{ label: "add-class", documentation: "대상 클래스의 클래스 추가" },
					{ label: "remove-class", documentation: "대상 클래스의 클래스 삭제" },
					{ label: "toggle-class", documentation: "대상 클래스의 클래스 토글" },
				].map((keyword) => ({
					label: keyword.label,
					kind: CompletionItemKind.Enum,
					textEdit: {
						range,
						newText: keyword.label + ",",
					},
					documentation: keyword.documentation,
					command: {
						title: "suggest",
						command: "editor.action.triggerSuggest",
					},
				}));
			}

			if (1 <= commaCount && commaCount <= 2) {
				return [...classSymbols].map((className) => ({
					label: className,
					kind: CompletionItemKind.EnumMember,
					textEdit: {
						range,
						newText: className + (commaCount === 2 ? ";" : ","),
					},
					command: {
						title: "suggest",
						command: "editor.action.triggerSuggest",
					},
				}));
			}
		}
	}
	else if ((node.type === "block_header" && node.parent?.type === "if_block") || node.type === "if_block") {
		const disallowedTriggerCharacter = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
		if (context.triggerKind === CompletionTriggerKind.TriggerCharacter && !disallowedTriggerCharacter.includes(context.triggerCharacter)) return [];

		const headerNode = node.type === "if_block" ? node.childForFieldName("expression") : node;

		return common.getTSCompletions(
			headerNode.text
		)
	}
	else if (node.type === "nowiki_content" && node.parent?.type === "style_block") {
		const prefix = [...classSymbols].map(className => (
			`.${className}{display:none;}`
		)).join("")

		let virtualText = prefix + node.text
		virtualText = virtualText.replace(/@theseed-dark-mode/g, '@media all and (n)')
		const virtualDoc = TextDocument.create(
			'namucode-virtual://embedded.css',
			'css',
			document.version,
			virtualText
		);

		const stylesheet = cssLanguageService.parseStylesheet(virtualDoc);
		const relativeOffset = positionIndex - node.startIndex + prefix.length;
		const virtualPosition = virtualDoc.positionAt(
				Math.max(0, Math.min(relativeOffset, virtualText.length))
		);

		const result = cssLanguageService.doComplete(virtualDoc, virtualPosition, stylesheet);

		for (const item of result.items) {
			const edit = item.textEdit;

			if (edit && "range" in edit) {
				const start = virtualDoc.offsetAt(edit.range.start)
				const end = virtualDoc.offsetAt(edit.range.end)

				item.textEdit = {
					range: {
						start: document.positionAt(node.startIndex + start - prefix.length),
						end: document.positionAt(node.startIndex + end - prefix.length)
					},
					newText: edit.newText
				}
			}
		}

		return result;
	}
	else if (node.type === "file_link_attribute" || node.type === "link_end" || node.type === "link_implicit_end") {
		if (node.parent.type !== "file_link") return [];

		const linkPipe = node.parent.children.find(child => child.type === "link_pipe")
		if (!linkPipe) return [];

		const linkEnd = node.parent.children.find(child => child.type === "link_end" || child.type === "link_implicit_end")
		if (!linkEnd) return [];
		
		const nodeStartIndex = linkPipe.endIndex
		const nodeEndIndex = linkEnd.startIndex
		const nodeText = document.getText({ start: document.positionAt(nodeStartIndex), end: document.positionAt(nodeEndIndex) })

		const regex = /([^=&]*)(?:=([^&]*))?/g;

		const matches = [...nodeText.matchAll(regex)].map(match => ({
				name: match[1],
				value: match[2],
				startIndex: nodeStartIndex + match.index,
				endIndex: nodeStartIndex + match.index + match[0].length,
				nameStartIndex: nodeStartIndex + match.index!,
				nameEndIndex: nodeStartIndex + match.index! + match[1].length,
				valueStartIndex: match[2] !== undefined ? nodeStartIndex + match.index! + match[1].length + match[2].length : null,
				valueEndIndex: match[2] !== undefined ? nodeStartIndex + match.index! + match[0].length : null
		}));

		const targetMatch = matches.find(match => match.startIndex <= positionIndex && positionIndex <= match.endIndex);
		if (!targetMatch) return [];
		
		if (targetMatch.nameStartIndex <= positionIndex && positionIndex <= targetMatch.nameEndIndex) {
			return common.fileLinkPropertyNames.map(property => ({
				label: property,
				insertText: property + "=",
				kind: CompletionItemKind.Property,
				command: !["border-radius", "height", "width"].includes(property) ? {
					command: "editor.action.triggerSuggest",
					title: "suggest"
				} : undefined
			}))
		}
		if (targetMatch.valueStartIndex <= positionIndex && positionIndex <= targetMatch.valueEndIndex) {
			if (["align", "object-fit", "rendering", "theme"].includes(targetMatch.name)) {
				return common.fileLinkPropertyValues[targetMatch.name].map(value => ({
					label: value,
					kind: CompletionItemKind.Keyword
				}))
			}
			if (targetMatch.name === "bgcolor") {
				return common.CSSColorKeywords.map(value => ({
					label: value,
					kind: CompletionItemKind.Keyword
				}))
			}
		}
	}
	else if (node.type === "table_cell_content" || node.parent?.type === "table_cell_content" || node.parent?.type === "table_argument") {
		const headRegex = /\|\|(?:<(?:[^>=|]*(?:\|[^>=|]+)?)(?:=(?:[^>|]*))?>)*<([^=>]*)/;
		const headMatch = line.match(new RegExp(headRegex.source + "$"));
		if (headMatch) {
			return [
				...common.tableArgumentsValueRequired.map(argument => ({
					label: argument,
					kind: CompletionItemKind.Property,
					insertText: argument + "=${1}",
					insertTextFormat: InsertTextFormat.Snippet,
					textEdit: {
						range: {
							start: {
								line: position.line,
								character: position.character - headMatch[1].length
							},
							end: {
								line: position.line,
								character: position.character
							}
						},
						newText: argument + "=${1}"
					},
					command: {
						title: "suggest",
						command: "editor.action.triggerSuggest"
					},
					sortText: argument.indexOf(" ") === -1 ? "a" : "b"
				})),
				...common.tableArgumentsValueOptional.map(argument => ({
					label: argument,
					kind: CompletionItemKind.Property,
					insertText: argument,
					insertTextFormat: InsertTextFormat.Snippet,
					textEdit: {
						range: {
							start: {
								line: position.line,
								character: position.character - headMatch[1].length
							},
							end: {
								line: position.line,
								character: position.character
							}
						},
						newText: argument
					},
					sortText: argument.indexOf(" ") === -1 ? "a" : "b"
				}))
			]
		}

		const valueRegex = new RegExp(`${headRegex.source}=([^>]*)$`);
		const name = line.match(valueRegex)?.[1];
		const value = line.match(valueRegex)?.[2] ?? "";
		if (name === undefined) return [];

		if (common.tableArgumentsAlign.includes(name)) {
			return common.tableArgumentValuesAlign.map(value => ({
				label: value,
				kind: CompletionItemKind.Value
			}))
		}

		if (common.tableArgumentsColor.includes(name)) {
			return common.CSSColorKeywords.map(color => ({
				label: color,
				kind: CompletionItemKind.EnumMember
			}))
		}

		if (common.tableArgumentsIf.includes(name)) {
			if (context.triggerKind === CompletionTriggerKind.TriggerCharacter && !context.triggerCharacter.includes("=")) return [];

			return common.getTSCompletions(
				value
			)
		}

		if (common.tableArgumentsClass.includes(name)) {
			return [...classSymbols].map(className => ({
				label: className,
				kind: CompletionItemKind.Variable,
				textEdit: {
					range: {
						start: { 
							line: position.line, 
							character: position.character - (value.length - value.lastIndexOf(" ") - 1)
						},
						end: { line: position.line, character: position.character }
					},
					newText: className
				}
			}))
		}
	}
	else if (node.parent?.type === "syntax_fallback_block" || node.parent?.type === "syntax_fallback_block_inline") {
		if (line.endsWith("{{{#!syntax ")) {
			return common.syntaxBlockLanguages.map(language => ({
				label: language,
				kind: CompletionItemKind.EnumMember
			}))
		}
	}
	else if (node.parent?.type === "scale_fallback_block" || node.parent?.type === "scale_fallback_block_inline") {
		if (line.endsWith("{{{+")) {
			return ["1", "2", "3", "4", "5"].map(size => ({
				label: `{{{+${size}`,
				kind: CompletionItemKind.Snippet,
				insertText: size + " "
			}))
		}

		if (line.endsWith("{{{-")) {
			return ["1", "2", "3", "4", "5"].map(size => ({
				label: `{{{-${size}`,
				kind: CompletionItemKind.Snippet,
				insertText: size + " "
			}))
		}
	}
	else if (node.parent?.type === "color_fallback_block" || node.parent?.type === "color_fallback_block_inline") {
		if (line.endsWith("{{{#")) {
			return [
				...common.CSSColorKeywords.map(color => ({
					label: color,
					kind: CompletionItemKind.EnumMember,
					insertText: color
				})),
				{
					label: "{{{#!",
					kind: CompletionItemKind.Snippet,
					insertText: "!",
					documentation: "#!(shebang)류 문법",
					command: {
						command: "editor.action.triggerSuggest",
						title: "suggest",
					},
					sortText: "a",
				}
			]
		}

		const colorBlockNextRegex = new RegExp(`{{{#([a-fA-F0-9]{3}|[a-fA-F0-9]{6}|${common.CSSColorKeywords.join("|")}),#$`, "i");
		if (colorBlockNextRegex.test(line)) {
			return [
				...common.CSSColorKeywords.map(color => ({
					label: color,
					kind: CompletionItemKind.EnumMember,
					insertText: color + " "
				}))
			]
		}
	}
	else if (node.parent?.type === "nowiki") {
		if (line.endsWith("{{{#!")) {
			return [
        {
          label: "if",
          kind: CompletionItemKind.Snippet,
          documentation: "조건부 텍스트 블록 생성",
          insertText: "if ${1}\n${0:내용}",
					insertTextFormat: InsertTextFormat.Snippet,
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        },
        {
          label: "folding",
          kind: CompletionItemKind.Snippet,
          insertText: "folding ${1:라벨}\n${0:내용}",
					insertTextFormat: InsertTextFormat.Snippet,
          documentation: "접기 블록 생성",
        },
        {
          label: "syntax",
          kind: CompletionItemKind.Snippet,
          documentation: "문법 강조 블록 생성",
          insertText: "syntax ${1}\n${0:내용}",
					insertTextFormat: InsertTextFormat.Snippet,
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        },
        {
          label: "wiki",
          kind: CompletionItemKind.Snippet,
          insertText: "wiki ${1}\n${0:내용}",
					insertTextFormat: InsertTextFormat.Snippet,
          documentation: "위키 스타일 블록 생성",
					command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        },
        {
          label: "html",
          kind: CompletionItemKind.Snippet,
          insertText: "html ${1:내용}",
					insertTextFormat: InsertTextFormat.Snippet,
          documentation: "HTML 블록 생성",
        },
        {
          label: "style",
          kind: CompletionItemKind.Snippet,
          insertText: "style\n${1:내용} ",
					insertTextFormat: InsertTextFormat.Snippet,
          documentation: "스타일 블록 생성",
        },
        {
          label: "latex",
          kind: CompletionItemKind.Snippet,
          insertText: "latex\n${1:내용} ",
					insertTextFormat: InsertTextFormat.Snippet,
          documentation: "LaTeX 블록 생성",
        },
      ];
		}
	}
	else if (node.type === "text" || node.parent?.type === "text" || node.type === "inline_text" || node.parent?.type === "inline_text") {
		if (line.endsWith("[") && !line.endsWith("[[")) {
			const link = {
				label: "[[ ]]",
				insertText: "[\${1:링크}]",
				insertTextFormat: InsertTextFormat.Snippet,
			}
			const footnote = {
				label: "[* ]",
				insertText: "* \${1:각주}",
				insertTextFormat: InsertTextFormat.Snippet,
			}

			return [
				...common.macrosArgumentRequired.map(macro => ({
						label: `[${macro}()]`,
						kind: CompletionItemKind.Unit,
						insertText: `${macro}(\${1:매개변수})`,
						insertTextFormat: InsertTextFormat.Snippet,
				})),
				...[...common.macrosArgumentOptional, ...common.macrosArgumentNone].map(macro => ({
						label: `[${macro}]`,
						kind: CompletionItemKind.Variable,
						insertText: macro,
				})),
				link, footnote
			]
		}

		const tableSnippetRegex = /(?:^|\s)table([1-9]|[1-4][0-9]|50)\*([1-9]|[1-4][0-9]|50)$/;
		const tableSnippetMatch = line.match(tableSnippetRegex);
		if (tableSnippetMatch) {
			const rows = parseInt(tableSnippetMatch[1]);
      const cols = parseInt(tableSnippetMatch[2]);

      let snippetText = "";
      let tabStopIndex = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          snippetText += `|| \${${tabStopIndex++}:내용} `;
        }
        snippetText += "||\n";
      }

			const matchText = tableSnippetMatch[0].trimStart();
      return [{
				label: `table${rows}*${cols}`,
				kind: CompletionItemKind.Snippet,
				insertText: snippetText,
				insertTextFormat: InsertTextFormat.Snippet,
				detail: `${rows}행 ${cols}열 표 삽입`,
				textEdit: {
						range: {
							start: {
								line: position.line,
								character: position.character - matchText.length
							},
							end: {
								line: position.line,
								character: position.character
							}
						},
						newText: snippetText
				}
			}];
		}
	}

	return []
}