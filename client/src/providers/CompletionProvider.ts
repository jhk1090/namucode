import * as vscode from "vscode";

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

class TableSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    const match = linePrefix.match(/(?:^|\s)table([1-9]|[1-4][0-9]|50)\*([1-9]|[1-4][0-9]|50)$/);

    if (match) {
      const rows = parseInt(match[1]);
      const cols = parseInt(match[2]);

      let snippetText = "";
      let tabStopIndex = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          snippetText += `|| \${${tabStopIndex++}:내용} `;
        }
        snippetText += "||\n";
      }

      const item = new vscode.CompletionItem(`table${rows}*${cols}`, vscode.CompletionItemKind.Snippet);
      item.insertText = new vscode.SnippetString(snippetText);
      item.detail = `${rows}행 ${cols}열 표 삽입`;

      const matchText = match[0].trimStart();
      const matchStart = position.character - matchText.length;
      item.range = new vscode.Range(position.line, matchStart, position.line, position.character);

      return [item];
    }
    return undefined;
  }
}

const fileLinkHeadRegex = /\[\[파일:([^\|\]\[]*)\|/g;
const fileLinkProperties = ["align", "bgcolor", "border-radius", "height", "object-fit", "rendering", "theme", "width"];
const fileLinkPropertiesCompletion = fileLinkProperties.map((property) => ({
  label: property,
  kind: vscode.CompletionItemKind.Property,
  insertText: `${property}=`,
  command: {
    title: "suggest",
    command: "editor.action.triggerSuggest",
  },
}));
function getFileLinkProperties() {
  return fileLinkPropertiesCompletion;
}
function fileLinkPropertyValueHandler(value: string) {
  return new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
}
const fileLinkPropertyPair = {
  align: ["bottom", "center", "left", "middle", "normal", "right", "top"].map(fileLinkPropertyValueHandler),
  bgcolor: colorTextOptions.map(fileLinkPropertyValueHandler),
  "border-radius": [],
  height: [],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"].map(fileLinkPropertyValueHandler),
  rendering: ["auto", "smooth", "high-quality", "pixelated", "crisp-edges"].map(fileLinkPropertyValueHandler),
  theme: ["light", "dark"].map(fileLinkPropertyValueHandler),
  width: [],
};

function getFileLinkPropertyValue(key: string) {
  return fileLinkPropertyPair[key];
}
class FileLinkPropertySnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["|", "&", "="];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    let fileLinkHeadMatch;
    fileLinkHeadRegex.lastIndex = 0;
    if ((fileLinkHeadMatch = fileLinkHeadRegex.exec(linePrefix))) {
      const fileLinkHeadEndRegex = new RegExp(fileLinkHeadRegex.source + "$", "g");
      const fileLinkPropertySplitRegex = /&$/g;
      const fileLinkPropertyRegex = new RegExp(`(${fileLinkProperties.join("|")})=$`, "g");
      fileLinkPropertySplitRegex.lastIndex = fileLinkHeadMatch.index + 1;
      fileLinkPropertyRegex.lastIndex = fileLinkHeadMatch.index + 1;

      let fileLinkPropertyMatch;
      if (fileLinkHeadEndRegex.exec(linePrefix) || fileLinkPropertySplitRegex.exec(linePrefix)) {
        return getFileLinkProperties();
      }

      if ((fileLinkPropertyMatch = fileLinkPropertyRegex.exec(linePrefix))) {
        return getFileLinkPropertyValue(fileLinkPropertyMatch[1]);
      }
    }

    return undefined;
  }
}

const macroArgumentRequired = ["anchor", "age", "dday", "youtube", "kakaotv", "vimeo", "nicovideo", "navertv", "math", "include", "ruby"].map(
  (macro) => {
    const item = new vscode.CompletionItem(`[${macro}()]`, vscode.CompletionItemKind.Unit);
    item.insertText = new vscode.SnippetString(macro + "(${1:매개변수})");
    return item;
  },
);

const macroArgumentOptional = ["pagecount", "목차", "tableofcontents"];
const macroArgumentLess = ["clearfix", "date", "datetime", "각주", "footnote", "br"];
const macroArgumentNotRequired = [...macroArgumentOptional, ...macroArgumentLess].map((macro) => {
  const item = new vscode.CompletionItem(`[${macro}]`, vscode.CompletionItemKind.Variable);
  item.insertText = macro;
  return item;
});
class SquareBracketSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["["];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    if (linePrefix.endsWith("[") && !linePrefix.endsWith("[[")) {
      const link = new vscode.CompletionItem(`[[ ]]`, vscode.CompletionItemKind.Snippet);
      link.insertText = new vscode.SnippetString("[${1:링크}]");

      const footnote = new vscode.CompletionItem("[* ]", vscode.CompletionItemKind.Snippet);
      footnote.insertText = new vscode.SnippetString("* ${1:각주}");

      return [...macroArgumentRequired, ...macroArgumentNotRequired, link, footnote];
    }

    return undefined;
  }
}

function getScaleTextOptions(prefix: "+" | "-") {
  const items: vscode.CompletionItem[] = [];

  const scaleList = ["1", "2", "3", "4", "5"];
  scaleList.forEach((scale) => {
    items.push({
      label: `{{{${prefix}${scale} `,
      kind: vscode.CompletionItemKind.Snippet,
      insertText: scale,
    });
  });

  return items;
}
class ScaleTextSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["+", "-"];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    if (linePrefix.endsWith("{{{+")) {
      return getScaleTextOptions("+");
    }

    if (linePrefix.endsWith("{{{-")) {
      return getScaleTextOptions("-");
    }

    return undefined;
  }
}

function getColorTextOptions(noShebang = false) {
  const items = [];

  items.push(
    ...colorTextOptions.map((color) => ({
      label: color,
      kind: vscode.CompletionItemKind.EnumMember,
      sortText: "b",
    })),
  );

  if (!noShebang) {
    items.push({
      label: "{{{#!",
      kind: vscode.CompletionItemKind.Snippet,
      insertText: "!",
      documentation: "#!(shebang)류 문법",
      command: {
        title: "suggest",
        command: "editor.action.triggerSuggest",
      },
      sortText: "a",
    });
  }

  return items;
}
const colorTextOptionsRegex = new RegExp(`{{{#([a-fA-F0-9]{3,6}|${colorTextOptions.join("|")}),#$`, "gi");
class ColorTextSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["#"];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    if (linePrefix.endsWith("{{{#")) {
      return getColorTextOptions();
    }

    colorTextOptionsRegex.lastIndex = 0;
    if (colorTextOptionsRegex.exec(linePrefix)) {
      return getColorTextOptions(true);
    }

    return undefined;
  }
}

class ShebangSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["!"];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    if (linePrefix.endsWith("{{{#!")) {
      return [
        {
          label: "if",
          kind: vscode.CompletionItemKind.Snippet,
          documentation: "조건부 텍스트 블록 생성",
          insertText: new vscode.SnippetString("if ${1}\n${0:내용}"),
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        },
        {
          label: "folding",
          kind: vscode.CompletionItemKind.Snippet,
          insertText: new vscode.SnippetString("folding ${1:라벨}\n${0:내용}"),
          documentation: "접기 블록 생성",
        },
        {
          label: "syntax",
          kind: vscode.CompletionItemKind.Snippet,
          documentation: "문법 강조 블록 생성",
          insertText: new vscode.SnippetString("syntax ${1}\n${0:내용}"),
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        },
        {
          label: "wiki",
          kind: vscode.CompletionItemKind.Snippet,
          documentation: "위키 스타일 블록 생성",
        },
        {
          label: "html",
          kind: vscode.CompletionItemKind.Snippet,
          insertText: new vscode.SnippetString("html ${1:내용}"),
          documentation: "HTML 블록 생성",
        },
        {
          label: "style",
          kind: vscode.CompletionItemKind.Snippet,
          insertText: new vscode.SnippetString("style\n${1:내용} "),
          documentation: "스타일 블록 생성",
        },
        {
          label: "latex",
          kind: vscode.CompletionItemKind.Snippet,
          insertText: new vscode.SnippetString("latex\n${1:내용} "),
          documentation: "LaTeX 블록 생성",
        },
      ];
    }

    return undefined;
  }
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
].map((language) => ({
  label: language,
  kind: vscode.CompletionItemKind.Variable,
  documentation: `${language} 언어 임베딩`,
}));
class SyntaxLanguagesSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = [" "];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    if (linePrefix.endsWith("{{{#!syntax ")) {
      return syntaxSyntaxLangs;
    }

    return undefined;
  }
}

class WikiSyntaxSnippetProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = [" "];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    const wikiSyntaxStartIndex = linePrefix.indexOf("{{{#!wiki ");
    const wikiSyntaxQuoteRegex = /"/g;
    if (wikiSyntaxStartIndex !== -1) {
      wikiSyntaxQuoteRegex.lastIndex = wikiSyntaxStartIndex;
      const quoteCount = (linePrefix.match(wikiSyntaxQuoteRegex) || []).length;
      if (quoteCount % 2 === 0) {
        return [
          {
            label: "style",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('style="${0}"'),
            documentation: "CSS 스타일 속성",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
          {
            label: "dark-style",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('dark-style="${0}"'),
            documentation: "CSS 스타일 속성 (다크 모드)",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
          {
            label: "class",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('class="${0}"'),
            documentation: "CSS 클래스 속성",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
          {
            label: "lang",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('lang="${0}"'),
            documentation: "언어 속성 (BCP 47)",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
          {
            label: "onclick",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('onclick="${0}"'),
            documentation: "클릭 이벤트 속성",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
          {
            label: "tag",
            kind: vscode.CompletionItemKind.Property,
            insertText: new vscode.SnippetString('tag="${0}"'),
            documentation: "HTML 태그 속성",
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          },
        ];
      }
    }

    return undefined;
  }
}

const argumentsColorValueRequired = [
  "tablecolor",
  "tablebgcolor",
  "tablebordercolor",
  "bgcolor",
  "colbgcolor",
  "rowbgcolor",
  "color",
  "colcolor",
  "rowcolor",
];
const argumentsClassValueRequired = ["tableclass", "class", "rowclass"];
const argumentsIfValueRequired = ["rowif"];
const argumentsCommonValueRequired = ["tablealign", "width", "height"];

const argumentsValueRequired = [
  ...argumentsColorValueRequired,
  ...argumentsClassValueRequired,
  ...argumentsIfValueRequired,
  ...argumentsCommonValueRequired,
];
const argumentsValueOptional = ["thead", "sortable", "keepall", "rowkeepall", "colkeepall", "nopad"];

class TableArgumentsProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["<"];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    const tableArgumentsRegex = /\|\|((<)([^>=|]*(?:\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<$/g;
    if (tableArgumentsRegex.exec(linePrefix)) {
      const items = [];

      argumentsValueRequired.forEach((argument) => {
        items.push({
          label: argument,
          kind: vscode.CompletionItemKind.Property,
          insertText: new vscode.SnippetString(argument + "=${1}>"),
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        });
      });
      argumentsValueOptional.forEach((argument) => {
        items.push({
          label: argument,
          kind: vscode.CompletionItemKind.Property,
          insertText: new vscode.SnippetString(`${argument}>`),
          command: {
            title: "suggest",
            command: "editor.action.triggerSuggest",
          },
        });
      });

      return items;
    }

    return undefined;
  }
}

class TableArgumentColorValueProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["="];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    const tableArgumentColorValueRegex = new RegExp(
      `\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsColorValueRequired.join("|")})=([^,]+,)?$`,
      "g",
    );
    if (tableArgumentColorValueRegex.exec(linePrefix)) {
      return colorTextOptions.map((color) => ({
        label: color,
        kind: vscode.CompletionItemKind.EnumMember,
        insertText: color,
      }));
    }

    return undefined;
  }
}

class TableArgumentCommonValueProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const charBeforeCursor = position.character > 0 ? linePrefix[position.character - 1] : "";
    const targetCharacters = ["="];

    if (context.triggerKind !== vscode.CompletionTriggerKind.TriggerCharacter && !targetCharacters.includes(charBeforeCursor)) {
      return undefined;
    }

    const tableArgumentCommonValueRegex = new RegExp(
      `\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(?<argumentType>${argumentsCommonValueRequired.join("|")})=$`,
      "g",
    );
    let tableArgumentCommonValueMatch;
    if ((tableArgumentCommonValueMatch = tableArgumentCommonValueRegex.exec(linePrefix))) {
      const argumentType = tableArgumentCommonValueMatch?.groups?.argumentType;
      if (argumentType === "tablealign") {
        return ["left", "center", "right"].map((color) => ({
          label: color,
          kind: vscode.CompletionItemKind.EnumMember,
          insertText: color,
        }));
      }
    }

    return undefined;
  }
}

export const registerCompletionProviders = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "namu" },
      new TableSnippetProvider(),
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider({ language: "namu" }, new FileLinkPropertySnippetProvider(), "|", "&", "="),
  );

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new SquareBracketSnippetProvider(), "["));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new ScaleTextSnippetProvider(), "+", "-"));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new ColorTextSnippetProvider(), "#"));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new ShebangSnippetProvider(), "!"));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new SyntaxLanguagesSnippetProvider(), " "));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new WikiSyntaxSnippetProvider(), " "));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new TableArgumentsProvider(), "<"));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new TableArgumentColorValueProvider(), "="));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: "namu" }, new TableArgumentCommonValueProvider(), "="));
};

export async function serverCompletionMiddleware(
  document: vscode.TextDocument,
  position: vscode.Position,
  context: vscode.CompletionContext,
  token: vscode.CancellationToken,
  next: any,
) {
  const line = document.lineAt(position).text.substring(0, position.character);

  const charBeforeCursor = position.character > 0 ? line[position.character - 1] : "";

  if ([" "].includes(charBeforeCursor)) {
    // CompletionProvider/SyntaxLanguagesSnippetProvider
    if (line.endsWith("{{{#!syntax ")) {
      return null;
    }

    // CompletionProvider/WikiSyntaxSnippetProvider
    const wikiSyntaxStartIndex = line.indexOf("{{{#!wiki ");
    const wikiSyntaxQuoteRegex = /"/g;
    if (wikiSyntaxStartIndex !== -1) {
      wikiSyntaxQuoteRegex.lastIndex = wikiSyntaxStartIndex;
      const quoteCount = (line.match(wikiSyntaxQuoteRegex) || []).length;
      if (quoteCount % 2 === 0) {
        return null;
      }
    }
  }

  if (["="].includes(charBeforeCursor)) {
    // CompletionProvider/FileLinkPropertySnippetProvider
    if (/\[\[파일:([^\|\]\[]*)\|(.+)=/.exec(line)) {
      return null;
    }

    // CompletionProvider/TableArgumentColorValueProvider
    const tableArgumentColorValueRegex = new RegExp(
      `\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsColorValueRequired.join("|")})=([^,]+,)?$`,
      "g",
    );
    if (tableArgumentColorValueRegex.exec(line)) {
      return null;
    }

    // CompletionProvider/TableArgumentCommonValueProvider
    const tableArgumentCommonValueRegex = new RegExp(
      `\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(?<argumentType>${argumentsCommonValueRequired.join("|")})=$`,
      "g",
    );
    let tableArgumentCommonValueMatch;
    if ((tableArgumentCommonValueMatch = tableArgumentCommonValueRegex.exec(line))) {
      const argumentType = tableArgumentCommonValueMatch?.groups?.argumentType;
      if (argumentType === "tablealign") {
        return null;
      }
    }
  }

  return await next(document, position, context, token);
}