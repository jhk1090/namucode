import { CompletionItem, CompletionItemKind, CompletionList, Position, TextDocument } from 'vscode-css-languageservice';
import { documentCache } from './server';
import { CompletionContext } from 'vscode-languageserver';

const languageList = [
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
];

export function provideCompletionSupport(document: TextDocument, position: Position, context: CompletionContext): CompletionList | CompletionItem[] {
	const minified = documentCache.get(document.uri)?.result.minified;
	const languageModes = documentCache.get(document.uri)?.languageModes;
	if (!minified && !languageModes) return null;

	const line = document.getText({ start: { line: position.line, character: 0 }, end: position });

	const tableArgumentClassValueRegex = new RegExp(`\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsClassValueRequired.join("|")})=([^>]+ )?$`, "g")
  if (tableArgumentClassValueRegex.exec(line)) {
    return getTableArgumentClassValue(minified);
  }

  const tableArgumentIfValueRegex = new RegExp(`\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsIfValueRequired.join("|")})=([^>]+ )?$`, "g")
  if (tableArgumentIfValueRegex.exec(line)) {
    return getTableArgumentIfValue(document, position);
  }

  const ifRegex = /\{\{\{#!if (?:(?!\}\}\}).)*$/g;
  if (ifRegex.exec(line)) {
    return languageModes.getMode("js").doComplete(document, position)
  }

  const wikiPropertyValueRegex = /\{\{\{#!wiki.*(style|dark-style|class|lang|onclick|tag)="(.*)$/g;
  let wikiPropertyValueMatch;
  if (wikiPropertyValueMatch = wikiPropertyValueRegex.exec(line)) {
    const property = wikiPropertyValueMatch[1];
    const value = wikiPropertyValueMatch[2];

    const cssClassNames: string[] = minified.data.cssClassNames
    if (property == "class") {
			return Array.from(new Set(cssClassNames)).map((className) => ({
          label: className,
          kind: CompletionItemKind.Class
        }))
    }
    if (property == "lang") {
      return languageList.map((language) => ({
          label: language.label,
          kind: CompletionItemKind.Enum,
          documentation: language.documentaion
        }));
    }
    if (property == "onclick") {
      const lastPart = value.split(";").pop().trim();
      const commaCount = (lastPart.match(/,/g) || []).length;

      if (commaCount <= 2 && value.trim().endsWith(",")) {
        return Array.from(new Set(cssClassNames)).map((className) => ({
            label: className,
            kind: 7,
            insertText: className + (commaCount === 2 ? ";" : ","),
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          }))
      } else {
        return [
            { label: "add-class", documentaion: "대상 클래스의 클래스 추가" },
            { label: "remove-class", documentaion: "대상 클래스의 클래스 삭제" },
            { label: "toggle-class", documentaion: "대상 클래스의 클래스 토글" },
          ].map((keyword) => ({
            label: keyword.label,
            kind: CompletionItemKind.Enum,
            insertText: keyword.label + ",",
            documentation: keyword.documentaion,
            command: {
              title: "suggest",
              command: "editor.action.triggerSuggest",
            },
          }))
      }
    }
    if (property == "tag") {
      return ["span", "a"].map((tag) => ({
          label: tag,
          kind: CompletionItemKind.Enum,
        }))
    }
  }

	if (context.triggerCharacter === "@" && /(?<!@[\p{L}\p{N}_]+(=[^\n\r@]+)?)@$/gu.exec(line)) {
		return languageModes.getMode("js").doComplete(document, position, { isArgumentCompletion: true })
	}

	const mode = languageModes.getModeAtPosition(position);
	if (!mode || !mode.doComplete) {
		return CompletionList.create();
	}
	const doComplete = mode.doComplete!;

	return doComplete(document, position);
}

const argumentsClassValueRequired = [
  "tableclass",
  "class",
  "rowclass",
]
const argumentsIfValueRequired = [
  "rowif",
]

function getTableArgumentClassValue(minified) {
  const cssClassNames: string[] = minified.data.cssClassNames
  return Array.from(new Set(cssClassNames)).map((className) => ({
      label: className,
      kind: CompletionItemKind.Class
    }))
}

function getTableArgumentIfValue(document, position) {
  const languageModes = documentCache.get(document.uri)?.languageModes
  return languageModes.getMode("js").doComplete(document, position)
}