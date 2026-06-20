import { CompletionList, Position, TextDocument } from 'vscode-css-languageservice';
import { documentCache } from './server';
import { CompletionContext } from 'vscode-languageserver';

export const provideCompletionSupport = (document: TextDocument, position: Position, context: CompletionContext) => {
	const languageModes = documentCache.get(document.uri)?.languageModes;
	if (!languageModes) return null;

	const line = document.getText({ start: { line: position.line, character: 0 }, end: position });

	const tableArgumentClassValueRegex = new RegExp(`\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsClassValueRequired.join("|")})=([^>]+ )?$`, "g")
  if (tableArgumentClassValueRegex.exec(line)) {
    return getTableArgumentClassValue(document, position);
  }

  const tableArgumentIfValueRegex = new RegExp(`\\|\\|((<)([^>=|]*(?:\\|[^>=|]+)?)(?:=([^>|]*))?(>)){0,}<(${argumentsIfValueRequired.join("|")})=([^>]+ )?$`, "g")
  if (tableArgumentIfValueRegex.exec(line)) {
    return getTableArgumentIfValue(document, position);
  }

	if (context.triggerCharacter === "@" && /(?<!@[\p{L}\p{N}_]*(=[^\n\r@]+)?)@$/gu.exec(line)) {
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

function getTableArgumentClassValue(document, position) {
  const languageModes = documentCache.get(document.uri)?.languageModes
  return languageModes.getMode("wiki-class").doComplete(document, position);
}

function getTableArgumentIfValue(document, position) {
  const languageModes = documentCache.get(document.uri)?.languageModes
  return languageModes.getMode("js").doComplete(document, position)
}