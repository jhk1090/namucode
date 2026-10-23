import ts from "typescript";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import { Node } from "web-tree-sitter";

export const CSSColorKeywords = [
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
  "transparent",
];

export const macrosArgumentRequired = ["anchor", "age", "dday", "youtube", "kakaotv", "vimeo", "nicovideo", "navertv", "math", "include", "ruby"];
export const macrosArgumentOptional = ["pagecount", "목차", "tableofcontents"];
export const macrosArgumentNone = ["clearfix", "date", "datetime", "각주", "footnote", "br"];

export const fileLinkPropertyNames = ["align", "bgcolor", "border-radius", "height", "object-fit", "rendering", "theme", "width"];
export const fileLinkPropertyValues = {
  align: ["bottom", "center", "left", "middle", "normal", "right", "top"],
  "object-fit": ["fill", "contain", "cover", "none", "scale-down"],
  rendering: ["auto", "smooth", "high-quality", "pixelated", "crisp-edges"],
  theme: ["light", "dark"],
};

export const tableArgumentsColor = [
  "tablebgcolor",
  "tablebordercolor",
  "table color",
  "table bgcolor",
  "table bordercolor",
  "bgcolor",
  "colbgcolor",
  "rowbgcolor",
  "color",
  "colcolor",
  "rowcolor",
];
export const tableArgumentsClass = ["tableclass", "class", "rowclass"];
export const tableArgumentsIf = ["rowif"];
export const tableArgumentsUnit = ["tablewidth", "table width", "width", "height"];
export const tableArgumentsAlign = ["tablealign", "table align"];
export const tableArgumentsValueRequired = [
  ...tableArgumentsColor,
  ...tableArgumentsClass,
  ...tableArgumentsIf,
  ...tableArgumentsUnit,
  ...tableArgumentsAlign,
];
export const tableArgumentsValueOptional = ["thead", "sortable", "keepall", "rowkeepall", "colkeepall", "nopad"];
export const tableArguments = [...tableArgumentsValueRequired, ...tableArgumentsValueOptional];
export const tableArgumentValuesAlign = ["left", "center", "right"];

export const wikiBlockLangAttributes = [
  { label: "ar", documentaion: "Arabic" },
  { label: "cs", documentaion: "Czech" },
  { label: "da", documentaion: "Danish" },
  { label: "de", documentaion: "German" },
  { label: "el", documentaion: "Greek" },
  { label: "en", documentaion: "English" },
  { label: "en-GB", documentaion: "English (UK)" },
  { label: "en-US", documentaion: "English (US)" },
  { label: "es", documentaion: "Spanish" },
  { label: "fi", documentaion: "Finnish" },
  { label: "fr", documentaion: "French" },
  { label: "he", documentaion: "Hebrew" },
  { label: "hi", documentaion: "Hindi" },
  { label: "hu", documentaion: "Hungarian" },
  { label: "id", documentaion: "Indonesian" },
  { label: "it", documentaion: "Italian" },
  { label: "ja", documentaion: "Japanese" },
  { label: "ja-JP", documentaion: "Japanese (Japan)" },
  { label: "ko", documentaion: "Korean" },
  { label: "ko-KR", documentaion: "Korean (South Korea)" },
  { label: "la", documentaion: "Latin" },
  { label: "mn", documentaion: "Mongolian" },
  { label: "ms", documentaion: "Malay" },
  { label: "nb", documentaion: "Norwegian (Bokmål)" },
  { label: "nl", documentaion: "Dutch" },
  { label: "pl", documentaion: "Polish" },
  { label: "pt", documentaion: "Portuguese" },
  { label: "pt-BR", documentaion: "Portuguese (Brazil)" },
  { label: "ro", documentaion: "Romanian" },
  { label: "ru", documentaion: "Russian" },
  { label: "sv", documentaion: "Swedish" },
  { label: "th", documentaion: "Thai" },
  { label: "tr", documentaion: "Turkish" },
  { label: "uk", documentaion: "Ukrainian" },
  { label: "vi", documentaion: "Vietnamese" },
  { label: "zh", documentaion: "Chinese" },
  { label: "zh-Hans", documentaion: "Chinese (Simplified)" },
  { label: "zh-Hant", documentaion: "Chinese (Traditional)" },
]

export const wikiBlockTagAttributes = ["span", "a"]

export const syntaxBlockLanguages = [
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
];

const fileName = "/namucode-virtual/completion.js";
let version = 0;
function getTSLanguageService(source: string) {
  version++;

  const options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.None,
    noEmit: true,
  };

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [fileName],

    getScriptVersion: () => String(version),

    getScriptSnapshot(name) {
      if (name === fileName) {
        return ts.ScriptSnapshot.fromString(source);
      }

      const text = ts.sys.readFile(name);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },

    getCurrentDirectory: () => "/",
    getCompilationSettings: () => options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,

    fileExists(name) {
      return name === fileName || ts.sys.fileExists(name);
    },

    readFile(name) {
      return name === fileName ? source : ts.sys.readFile(name);
    },

    readDirectory: ts.sys.readDirectory,
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function convertKind(kind: string): CompletionItemKind {
  switch (kind) {
    case "primitive type":
    case "keyword":
      return CompletionItemKind.Keyword;
    case "var":
    case "let":
    case "const":
      return CompletionItemKind.Variable;
    case "function":
      return CompletionItemKind.Function;
    case "method":
      return CompletionItemKind.Method;
    case "property":
      return CompletionItemKind.Property;
    case "class":
      return CompletionItemKind.Class;
    case "interface":
      return CompletionItemKind.Interface;
    default:
      return CompletionItemKind.Text;
  }
}

export const allTSVariables = new Set<string>();

export function getTSCompletions(text: string, isArgumentCompletion: boolean = false): CompletionItem[] {
  if (isArgumentCompletion) {
    allTSVariables.add("calleeTitle");
    return [
      ...allTSVariables
    ].map((symbol) => ({
      label: symbol,
      kind: CompletionItemKind.Variable,
      insertText: symbol + "@",
    }));
  }

  const declarations = [
    ...Array.from(allTSVariables).map((variable) => {
      if (/^\d/.test(variable)) return `this["${variable}"] = "";`
      return `declare const ${variable}: string;`
    }),
    "declare const calleeTitle: string;",
    "declare function time(): number;",
  ].join("\n");

  const prefix = declarations ? declarations + "\n" : "";
  const service = getTSLanguageService(prefix + text);

  const result = service.getCompletionsAtPosition(fileName, prefix.length + text.length, {
    includeCompletionsWithInsertText: true,
    includeCompletionsForModuleExports: false,
  });

  if (!result) return [];

  return result.entries.map((entry) => ({
    label: entry.name,
    kind: convertKind(entry.kind),
    sortText: entry.sortText,
    ...(entry.insertText !== undefined
      ? {
          insertText: entry.insertText,
        }
      : convertKind(entry.kind) === CompletionItemKind.Variable && /^\d/.test(entry.name) && { insertText: `this["${entry.name}"]` }),
  }));
}

export function getTSDiagnostics(document: TextDocument, node: Node) {
  const service = getTSLanguageService(node.text);

  return [...service.getSyntacticDiagnostics(fileName), ...service.getSemanticDiagnostics(fileName)].map((diagnostic) => ({
    range: {
      start: document.positionAt(node.startIndex + diagnostic.start),
      end: document.positionAt(node.startIndex + diagnostic.start + diagnostic.length),
    },
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));
}
