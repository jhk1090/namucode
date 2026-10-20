import { Edit, Language, Parser, Query, Tree } from "web-tree-sitter";
import path from "path";
import { updateDiagnostics } from "./diagnostics";
import { DidChangeTextDocumentParams } from "vscode-languageserver";
import { documents } from "./server";
import { Position, TextDocument, TextDocumentContentChangeEvent } from "vscode-languageserver-textdocument";

interface Cache {
  version: number;
  tree: Tree;
  text: string;
}
export let cache = new Map<string, Cache>();

let parser: Parser;
let language: Language;
export let foldingQuery: Query;
export let linkQuery: Query;
export let diagnosticsQuery: Query;
export let jsCompletionQuery: Query;
export let classCompletionQuery: Query;
export let documentSymbolQuery: Query;
export async function initTreeSitter() {
  await Parser.init();

  parser = new Parser();
  const wasmPath = path.join(process.env.NAMUCODE_EXTENSION_PATH, "dist/media/tree-sitter-namumark.wasm");

  language = await Language.load(wasmPath);
  parser.setLanguage(language);

  foldingQuery = new Query(
    language,
    `
			[
				(nowiki (bracket_end))
				(if_block (bracket_end))
				(folding_block (bracket_end))
				(syntax_block (bracket_end))
				(wiki_block (bracket_end))
				(html_block (bracket_end))
				(style_block (bracket_end))
				(latex_block (bracket_end))
				(scale_block (bracket_end))
				(color_block (bracket_end))
				(if_fallback_block (bracket_end))
				(folding_fallback_block (bracket_end))
				(syntax_fallback_block (bracket_end))
				(wiki_fallback_block (bracket_end))
				(style_fallback_block (bracket_end))
				(latex_fallback_block (bracket_end))
				(scale_fallback_block (bracket_end))
				(color_fallback_block (bracket_end))
        (section (heading))
			] @folding
	`,
  );
  linkQuery = new Query(
    language,
    `
      (link 
        (link_link) @link
        (link_end))
      (link_inline
        (link_link_inline) @link
        (link_end))
      (file_link 
        (file_link_link) @link
        (link_end))
      (macro 
        (required_arg_macro_name) @_macro_name
        (macro_end)
        (#any-of? @_macro_name "youtube" "kakaotv" "vimeo" "nicovideo" "navertv" "include")) @macro
	`,
  );
  diagnosticsQuery = new Query(
    language,
    `
    (_ (argument_implicit_end)) @argument_implicit_end
    (_ (bracket_implicit_end)) @bracket_implicit_end
    (_ (macro_implicit_end)) @macro_implicit_end
    (_ (link_implicit_end)) @link_implicit_end
    (_ (bold_implicit_end)) @bold_implicit_end
    (_ (italic_implicit_end)) @italic_implicit_end
    (_ (strike_implicit_end)) @strike_implicit_end
    (_ (strike2_implicit_end)) @strike2_implicit_end
    (_ (superscript_implicit_end)) @superscript_implicit_end
    (_ (subscript_implicit_end)) @subscript_implicit_end
    (_ (underline_implicit_end)) @underline_implicit_end
    (_ (footnote_implicit_end)) @footnote_implicit_end
    (_ (table_row_implicit_end)) @table_row_implicit_end
    (_ (table_caption_implicit_end)) @table_caption_implicit_end
    (_ (table_argument_implicit_end)) @table_argument_implicit_end
    (horizontal_line_implicit) @horizontal_line_implicit
    (table_argument) @table_argument
    (if_block (if_block_header) @if_block_header)
    (wiki_block (block_header) @wiki_block_header)
    (macro_without_args) @macro_without_args
    (macro) @macro
    (style_block
        content: (_) @style_block_content
        (bracket_end))
    (if_fallback_block (bracket_end)) @if_fallback_block
    (folding_fallback_block (bracket_end)) @folding_fallback_block
    (syntax_fallback_block (bracket_end)) @syntax_fallback_block
    (wiki_fallback_block (bracket_end)) @wiki_fallback_block
    (style_fallback_block (bracket_end)) @style_fallback_block
    (latex_fallback_block (bracket_end)) @latex_fallback_block
    (scale_fallback_block (bracket_end)) @scale_fallback_block
    (color_fallback_block (bracket_end)) @color_fallback_block
    (file_link (file_link_attribute) @file_link_attribute)
    `,
  );
  jsCompletionQuery = new Query(
    language,
    `
    (if_block (if_block_header) @if_block_header)
    (table_argument (table_argument_required_value_name "rowif") (table_argument_value) @table_argument_rowif_value)
    (argument_name) @argument_name
  `,
  );
  classCompletionQuery = new Query(
    language,
    `
    (table_argument
        (table_argument_required_value_name) @_name
        (table_argument_value) @table_argument_class_value
        (#any-of? @_name "tableclass" "rowclass" "class"))
    (wiki_block (block_header) @wiki_block_header)
    (style_block (nowiki_content) @style_block_content)
    `,
  );
  documentSymbolQuery = new Query(
    language,
    `
    (text_inline) @text_inline
    (escape) @escape
    `
  )
}

function offsetAt(text: string, position: Position): number {
  let offset = 0;
  let line = 0;

  while (line < position.line) {
    const newline = text.indexOf("\n", offset);

    if (newline === -1) {
      return text.length;
    }

    offset = newline + 1;
    line++;
  }

  const newline = text.indexOf("\n", offset);
  const lineEnd = newline === -1 ? text.length : newline;

  return Math.min(offset + position.character, lineEnd);
}

function treeSitterPositionAt(text: string, offset: number) {
  const lines = text.slice(0, offset).split(/\r\n|\r|\n/);

  return {
    row: lines.length - 1,
    column: lines[lines.length - 1].length,
  };
}

function positionAfterText(start: { row: number; column: number }, text: string) {
  const lines = text.split(/\r\n|\r|\n/);

  if (lines.length === 1) {
    return {
      row: start.row,
      column: start.column + lines[0].length,
    };
  }

  return {
    row: start.row + lines.length - 1,
    column: lines[lines.length - 1].length,
  };
}

function convertToTreeSitterEdit(oldText: string, change: TextDocumentContentChangeEvent) {
  if (!("range" in change)) {
    throw new Error("Incremental change requires a range");
  }

  const startOffset = offsetAt(oldText, change.range.start);
  const oldEndOffset = offsetAt(oldText, change.range.end);

  const startIndex = startOffset;
  const oldEndIndex = oldEndOffset;
  const newEndIndex = startIndex + change.text.length;

  const startPosition = treeSitterPositionAt(oldText, startOffset);
  const oldEndPosition = treeSitterPositionAt(oldText, oldEndOffset);

  return {
    startIndex,
    oldEndIndex,
    newEndIndex,
    startPosition,
    oldEndPosition,
    newEndPosition: positionAfterText(startPosition, change.text),
  };
}

function canApplyChangesIncrementally(text: string, changes: readonly TextDocumentContentChangeEvent[]): boolean {
  if (changes.length !== 1) return false;

  const change = changes[0];

  if (!("range" in change)) return false;

  return true;
}

export function makeTree(document: TextDocument) {
  const key = document.uri.toString();
  if (document.languageId !== "namu") return;

  if (!cache.has(key)) {
    const text = document.getText();
    const tree = parser.parse(text);
    const version = document.version;

    cache.set(key, { tree, version, text });

    updateDiagnostics(document);
  }
}

export function updateTree(params: DidChangeTextDocumentParams) {
  const document = documents.get(params.textDocument.uri);
  const key = document.uri.toString();
  const version = document.version;

  if (document.languageId !== "namu") return;

  const cached = cache.get(key);
  if (cached?.version === version) return;

  let oldTree: Tree | undefined;
  if (cached && cached.version === version - 1 && canApplyChangesIncrementally(cached.text, params.contentChanges)) {
    oldTree = cached.tree;
    const change = params.contentChanges[0];
    oldTree.edit(new Edit(convertToTreeSitterEdit(cached.text, change)));
  }

  const newTree = parser.parse(document.getText(), oldTree);
  cache.set(key, { tree: newTree, version, text: document.getText() });

  updateDiagnostics(document);
}
