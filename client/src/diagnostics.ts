import vscode from "vscode";
import { cache, diagnosticsQuery } from './parser';
import { colorTextOptions } from './providers/CompletionProvider';

export const diagnostics = vscode.languages.createDiagnosticCollection('namucode');

const requiredArgMacros = ["anchor", "age", "dday", "youtube", "kakaotv", "vimeo", "nicovideo", "navertv", "math", "include", "ruby"]
const colorBlockColorRegex = new RegExp(`^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6}|${colorTextOptions.join("|")})$`, "i");

export function updateDiagnostics(document: vscode.TextDocument) {
	const errors: vscode.Diagnostic[] = [];
	
	const tree = cache.get(document.uri.toString())?.tree;
	if (!tree) {
		return [];
	}

	for (const { name, node } of diagnosticsQuery.captures(tree.rootNode)) {
		if (name.endsWith("_implicit_end")) {
			const implicitEndNode = node.children.at(-1);
	
			const startPos = document.positionAt(implicitEndNode.startIndex);
			const endPos = document.positionAt(implicitEndNode.endIndex);
	
			const range = new vscode.Range(startPos, endPos);
	
			let character = "";
			switch (name) {
				case "argument_implicit_end": character = "@"; break;
				case "bracket_implicit_end": character = "}}}"; break;
				case "macro_implicit_end": character = ")]"; break;
				case "link_implicit_end": character = "]]"; break;
				case "bold_implicit_end": character = "'''"; break;
				case "italic_implicit_end": character = "''"; break;
				case "strike_implicit_end": character = "--"; break;
				case "strike2_implicit_end": character = "~~"; break;
				case "superscript_implicit_end": character = "^^"; break;
				case "subscript_implicit_end": character = ",,"; break;
				case "underline_implicit_end": character = "__"; break;
				case "footnote_implicit_end": character = "]"; break;
				case "table_row_implicit_end": character = "||"; break;
				case "table_caption_implicit_end": character = "|"; break;
				case "table_argument_implicit_end": character = ">"; break;
			}
	
			errors.push(new vscode.Diagnostic(range, `종료 기호 ${character}가 누락되었습니다.`, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "horizontal_line_implicit") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);

			errors.push(new vscode.Diagnostic(range, `수평줄의 길이는 4~9자여야 합니다.`, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "unknown_table_argument_name") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);
			
			errors.push(new vscode.Diagnostic(range, `${node.text}은/는 유효한 매개변수가 아닙니다.`, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "wiki_attribute") {
			if (node.childForFieldName("end")) continue;

			const startPos = document.positionAt(node.children[0].startIndex);
			const endPos = document.positionAt(node.children[0].endIndex);
	
			const range = new vscode.Range(startPos, endPos);
			
			errors.push(new vscode.Diagnostic(range, `종료 기호 "가 누락되었습니다.`, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "macro_without_args") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);

			if (requiredArgMacros.includes(node.text.slice(1, -1))) {
				errors.push(new vscode.Diagnostic(range, `'${node.text.slice(1, -1)}' 매크로는 매개변수가 1개 이상 필요합니다.`, vscode.DiagnosticSeverity.Error))
			}
		}
		else if (name === "unnecessary_macro_argument") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);
			
			errors.push(new vscode.Diagnostic(range, `'${node.text}' 매크로는 매개변수를 받지 않습니다.`, vscode.DiagnosticSeverity.Warning))
		}
		else if (name === "if_fallback_block") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);
			
			let message = "";
			if (node.text.indexOf("\n") != -1) {
				message = "#!if 다음에는 반드시 최소 한 개의 공백이 와야합니다."
			} else {
				message = "줄바꿈이 필요합니다."
			}

			errors.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "folding_fallback_block" || name === "wiki_fallback_block") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);

			errors.push(new vscode.Diagnostic(range, "줄바꿈이 필요합니다.", vscode.DiagnosticSeverity.Error))
		}
		else if (name === "syntax_fallback_block") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);
			
			let message = "";
			if (node.text.indexOf("\n") != -1) {
				const language = node.text.slice(11).split(/\r?\n/)[0].slice(1)
				message = `'${language}'은/는 유효한 언어가 아닙니다.`
			} else {
				message = "줄바꿈이 필요합니다."
			}

			errors.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "style_fallback_block" || name === "latex_fallback_block") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);

			let message = ""
			if (node.text.indexOf("\n") != -1) {
				const type = name.split("_fallback_block")[0]
				message = `#!${type} 다음에는 반드시 줄바꿈이 와야 합니다.`
			} else {
				message = "줄바꿈이 필요합니다."
			}
			errors.push(new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error))
		}
		else if (name === "scale_fallback_block") {
			const startPos = document.positionAt(node.startIndex);
			const endPos = document.positionAt(node.endIndex);
	
			const range = new vscode.Range(startPos, endPos);

			const target = node.text.slice(3, 5);
			const size = parseInt(target[1])
			
			if (!isNaN(size)) {
				if (size >= 1 && size <= 5) {
					errors.push(new vscode.Diagnostic(range, `${target} 다음에는 반드시 공백 또는 줄바꿈이 와야 합니다.`, vscode.DiagnosticSeverity.Error))
				} else {
					errors.push(new vscode.Diagnostic(range, "크기는 1 이상 5 이하여야 합니다.", vscode.DiagnosticSeverity.Warning))	
				}
			}
		}
		else if (name === "color_fallback_block") {
			const target = node.text.slice(3, -3);
			const [color1, color2] = target.split("\n")[0].split(" ")[0].split(",")

			let offset = 3;
			if (color1 !== undefined && !colorBlockColorRegex.test(color1)) {
				const startPos = document.positionAt(node.startIndex + offset);
				const endPos = document.positionAt(node.startIndex + offset + color1.length);

				const range = new vscode.Range(startPos, endPos);

				errors.push(new vscode.Diagnostic(range, `'${color1}'은/는 유효하지 않은 색상입니다.`, vscode.DiagnosticSeverity.Error))
			}

			if (color1 !== undefined) { 
				offset += color1.length
			}

			if (color2 !== undefined) {
				offset += ",".length

				if (color2.length == 0) {
					const startPos = document.positionAt(node.startIndex + offset - 1);
					const endPos = document.positionAt(node.startIndex + offset);
	
					const range = new vscode.Range(startPos, endPos);
	
					errors.push(new vscode.Diagnostic(range, `두 번째 색상이 입력되지 않았습니다.`, vscode.DiagnosticSeverity.Error))
				}
	
				if (color2.length > 0 && !colorBlockColorRegex.test(color2)) {
					const startPos = document.positionAt(node.startIndex + offset);
					const endPos = document.positionAt(node.startIndex + offset + color2.length);
	
					const range = new vscode.Range(startPos, endPos);
	
					errors.push(new vscode.Diagnostic(range, `'${color2}'은/는 유효하지 않은 색상입니다.`, vscode.DiagnosticSeverity.Error))
				}
	
				offset += color2.length
			}

			const separator = node.text[offset]
			if (separator != " " && separator != "\r" && separator != "\n") {
				const startPos = document.positionAt(node.startIndex);
				const endPos = document.positionAt(node.endIndex);

				const range = new vscode.Range(startPos, endPos);

				errors.push(new vscode.Diagnostic(range, `색상 다음에는 반드시 공백 또는 줄바꿈이 와야 합니다.`, vscode.DiagnosticSeverity.Error))
			}
		}
	}

	diagnostics.set(document.uri, errors);
}