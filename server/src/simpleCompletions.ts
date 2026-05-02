import { CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat, Position } from "vscode-html-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";

export function simpleCompletions(document: TextDocument, position: Position): CompletionList | null {
  const line = document.getText({ start: { line: position.line, character: 0 }, end: position });

	if (line.startsWith("[") && !line.startsWith("[[")) {
		return getSquareBracketSyntaxes();
	}

	if (line.endsWith("{{{+")) {
		return getScaleTextOptions("+");
	}

	if (line.endsWith("{{{-")) {
		return getScaleTextOptions("-");
	}

  if (line.endsWith("{{{#")) {
    return getColorTextOptions();
  }

  if (line.endsWith("{{{#!")) {
    return getShebangList();
  }

  if (line.endsWith("{{{#!syntax ")) {
    return getSyntaxSyntaxLanguages();
  }

  const wikiSyntaxStartIndex = line.indexOf("{{{#!wiki ");
  const wikiSyntaxQuoteRegex = /"/g;
  if (wikiSyntaxStartIndex !== -1) {
    wikiSyntaxQuoteRegex.lastIndex = wikiSyntaxStartIndex;
    const quoteCount = (line.match(wikiSyntaxQuoteRegex) || []).length;
    if (quoteCount % 2 === 0) {
      return getWikiSyntaxProperties();
    }
  }

	return null;
}

const macroArgumentRequired = [
  "anchor",
  "age",
  "dday",
  "youtube",
  "kakaotv",
  "vimeo",
  "nicovideo",
  "navertv",
  "math",
  "include",
  "ruby",
];

const macroArgumentOptional = ["pagecount", "목차", "tableofcontents"];
const macroArgumentLess = ["clearfix", "date", "datetime", "각주", "footnote", "br"];
const macroArgumentNotRequired = [...macroArgumentOptional, ...macroArgumentLess]

function getSquareBracketSyntaxes() {
	const items: CompletionItem[] = []
	macroArgumentRequired.forEach(macro => {
		items.push({
			label: `[${macro}()]`,
			kind: CompletionItemKind.Unit,
			insertText: macro + "(${1:매개변수})",
			insertTextFormat: InsertTextFormat.Snippet
		})
	})
	
	macroArgumentNotRequired.forEach(macro => {
		items.push({
			label: `[${macro}]`,
			kind: CompletionItemKind.Variable,
			insertText: macro
		})
	})

	items.push({
		label: "[[ ]]",
		kind: CompletionItemKind.Snippet,
		insertText: "[${1:링크}]",
		insertTextFormat: InsertTextFormat.Snippet
	})

	items.push({
		label: "[* ]",
		kind: CompletionItemKind.Snippet,
		insertText: "* ${1:각주}",
		insertTextFormat: InsertTextFormat.Snippet
	})

  return {
    isIncomplete: false,
    items
  };
}

function getScaleTextOptions(prefix: "+" | "-") {
	const items: CompletionItem[] = []

	const scaleList = ["1", "2", "3", "4", "5"];
	scaleList.forEach(scale => {
		items.push({
			label: `{{{${prefix}${scale} `,
			kind: CompletionItemKind.Snippet,
			insertText: scale,
			insertTextFormat: InsertTextFormat.Snippet
		})	
	})

  return {
    isIncomplete: false,
    items
  };
}

const colorTextOptions = [
  "AliceBlue",
  "AntiqueWhite",
  "Aqua",
  "Aquamarine",
  "Azure",
  "Beige",
  "Bisque",
  "Black",
  "BlanchedAlmond",
  "Blue",
  "BlueViolet",
  "Brown",
  "BurlyWood",
  "CadetBlue",
  "Chartreuse",
  "Chocolate",
  "Coral",
  "CornflowerBlue",
  "Cornsilk",
  "Crimson",
  "Cyan",
  "DarkBlue",
  "DarkCyan",
  "DarkGoldenRod",
  "DarkGray",
  "DarkGrey",
  "DarkGreen",
  "DarkKhaki",
  "DarkMagenta",
  "DarkOliveGreen",
  "DarkOrange",
  "DarkOrchid",
  "DarkRed",
  "DarkSalmon",
  "DarkSeaGreen",
  "DarkSlateBlue",
  "DarkSlateGray",
  "DarkSlateGrey",
  "DarkTurquoise",
  "DarkViolet",
  "DeepPink",
  "DeepSkyBlue",
  "DimGray",
  "DimGrey",
  "DodgerBlue",
  "FireBrick",
  "FloralWhite",
  "ForestGreen",
  "Fuchsia",
  "Gainsboro",
  "GhostWhite",
  "Gold",
  "GoldenRod",
  "Gray",
  "Grey",
  "Green",
  "GreenYellow",
  "HoneyDew",
  "HotPink",
  "IndianRed",
  "Indigo",
  "Ivory",
  "Khaki",
  "Lavender",
  "LavenderBlush",
  "LawnGreen",
  "LemonChiffon",
  "LightBlue",
  "LightCoral",
  "LightCyan",
  "LightGoldenRodYellow",
  "LightGray",
  "LightGrey",
  "LightGreen",
  "LightPink",
  "LightSalmon",
  "LightSeaGreen",
  "LightSkyBlue",
  "LightSlateGray",
  "LightSlateGrey",
  "LightSteelBlue",
  "LightYellow",
  "Lime",
  "LimeGreen",
  "Linen",
  "Magenta",
  "Maroon",
  "MediumAquaMarine",
  "MediumBlue",
  "MediumOrchid",
  "MediumPurple",
  "MediumSeaGreen",
  "MediumSlateBlue",
  "MediumSpringGreen",
  "MediumTurquoise",
  "MediumVioletRed",
  "MidnightBlue",
  "MintCream",
  "MistyRose",
  "Moccasin",
  "NavajoWhite",
  "Navy",
  "OldLace",
  "Olive",
  "OliveDrab",
  "Orange",
  "OrangeRed",
  "Orchid",
  "PaleGoldenRod",
  "PaleGreen",
  "PaleTurquoise",
  "PaleVioletRed",
  "PapayaWhip",
  "PeachPuff",
  "Peru",
  "Pink",
  "Plum",
  "PowderBlue",
  "Purple",
  "RebeccaPurple",
  "Red",
  "RosyBrown",
  "RoyalBlue",
  "SaddleBrown",
  "Salmon",
  "SandyBrown",
  "SeaGreen",
  "SeaShell",
  "Sienna",
  "Silver",
  "SkyBlue",
  "SlateBlue",
  "SlateGray",
  "SlateGrey",
  "Snow",
  "SpringGreen",
  "SteelBlue",
  "Tan",
  "Teal",
  "Thistle",
  "Tomato",
  "Turquoise",
  "Violet",
  "Wheat",
  "White",
  "WhiteSmoke",
  "Yellow",
  "YellowGreen",
];

function getColorTextOptions() {
  return {
    isIncomplete: false,
    items: [
      ...colorTextOptions.map((color) => ({
        label: color,
        kind: CompletionItemKind.EnumMember,
        sortText: "b",
      })),
      {
        label: "{{{#!",
        kind: CompletionItemKind.Snippet,
        insertText: "!",
        documentation: "#!(shebang)류 문법",
        command: {
          title: "suggest",
          command: "editor.action.triggerSuggest",
        },
        sortText: "a",
      },
    ],
  };
}

function getShebangList() {
  return {
    isIncomplete: false,
    items: [
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
        documentation: "위키 스타일 블록 생성",
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
    ],
  };
}

const syntaxSyntaxLangs = [
  "basic",
  "cpp",
  "csharp",
  "css",
  "erlang",
  "go",
  "html",
  "javascript",
  "java",
  "json",
  "kotlin",
  "lisp",
  "lua",
  "markdown",
  "objectivec",
  "perl",
  "php",
  "powershell",
  "python",
  "ruby",
  "rust",
  "sh",
  "sql",
  "swift",
  "typescript",
  "xml",
  "erlang",
  "kotlin",
  "lisp",
];
function getSyntaxSyntaxLanguages() {
  return {
    isIncomplete: false,
    items: syntaxSyntaxLangs.map((lang) => {
      return {
        label: lang,
        kind: CompletionItemKind.Variable,
        documentation: `${lang} 언어 임베딩`,
      };
    }),
  };
}

function getWikiSyntaxProperties() {
  return {
    isIncomplete: false,
    items: [
      {
        label: "style",
        kind: CompletionItemKind.Property,
        insertText: 'style="${0}"',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "CSS 스타일 속성",
        command: {
          title: "suggest",
          command: "editor.action.triggerSuggest",
        },
      },
      {
        label: "dark-style",
        kind: CompletionItemKind.Property,
        insertText: 'dark-style="${0}"',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "CSS 스타일 속성 (다크 모드)",
        command: {
          title: "suggest",
          command: "editor.action.triggerSuggest",
        },
      },
      {
        label: "class",
        kind: CompletionItemKind.Property,
        insertText: 'class="${0}"',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "CSS 클래스 속성",
        command: {
          title: "suggest",
          command: "editor.action.triggerSuggest",
        },
      },
      {
        label: "lang",
        kind: CompletionItemKind.Property,
        insertText: 'lang="${0}"',
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: "언어 속성 (BCP 47)",
        command: {
          title: "suggest",
          command: "editor.action.triggerSuggest",
        },
      },
    ],
  };
}
