import * as vscode from "vscode";
import { Edit, Language, Parser, Query, Tree } from 'web-tree-sitter';
import path from "path";
import { updateDiagnostics } from './diagnostics';

interface Cache {
	version: number;
	tree: Tree;
    text: string;
}
export let cache = new Map<string, Cache>;

let parser: Parser;
let language: Language;
export let foldingQuery: Query;
export let linkQuery: Query;
export let diagnosticsQuery: Query;
export async function initTreeSitter(context: vscode.ExtensionContext) {
  await Parser.init();

  parser = new Parser();
  const wasmPath = path.join(
    context.extensionPath,
    "dist/media/tree-sitter-namumark.wasm"
  )

  language = await Language.load(wasmPath);
  parser.setLanguage(language);

  foldingQuery = new Query(language, `
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
	`);
  linkQuery = new Query(language, `
			(link 
        (link_link) @link
        (link_end))
      (file_link 
        (file_link_link) @link
        (link_end))
      (macro 
        (required_arg_macro_name ("include"))
        (macro_end)) @macro
	`);
  diagnosticsQuery = new Query(language, `
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
    (table_argument (table_argument_name) @unknown_table_argument_name)
    [
        (wiki_style_attr)
        (wiki_dark_style_attr)
        (wiki_tag_attr)
        (wiki_class_attr)
        (wiki_lang_attr)
        (wiki_onclick_attr)
    ] @wiki_attribute
    (macro_without_args) @macro_without_args
    (macro (no_arg_macro_name) @unnecessary_macro_argument)
    (if_fallback_block (bracket_end)) @if_fallback_block
    (folding_fallback_block (bracket_end)) @folding_fallback_block
    (syntax_fallback_block (bracket_end)) @syntax_fallback_block
    (wiki_fallback_block (bracket_end)) @wiki_fallback_block
    (style_fallback_block (bracket_end)) @style_fallback_block
    (latex_fallback_block (bracket_end)) @latex_fallback_block
    (scale_fallback_block (bracket_end)) @scale_fallback_block
    (color_fallback_block (bracket_end)) @color_fallback_block
    `)
}

function treeSitterPositionAt(text: string, offset: number) {
    const lines = text.slice(0, offset).split(/\r\n|\r|\n/);

    return {
        row: lines.length - 1,
        column: lines[lines.length - 1].length,
    };
}

function positionAfterText(
    start: { row: number; column: number },
    text: string
) {
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

function convertToTreeSitterEdit(
	 oldText: string,
    change: vscode.TextDocumentContentChangeEvent
) {
    const startOffset = change.rangeOffset;
    const oldEndOffset = startOffset + change.rangeLength;
    const startIndex = oldText.slice(0, startOffset).length;
    const oldEndIndex = oldText.slice(0, oldEndOffset).length;
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

function canApplyChangesIncrementally(
    text: string,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
): boolean {
    if (changes.length !== 1) return false;

    const change = changes[0];
    if (
        change.rangeOffset < 0 ||
        change.rangeLength < 0 ||
        change.rangeOffset + change.rangeLength > text.length
    ) {
        return false;
    }

    return true;
}

export function makeTree(document: vscode.TextDocument) {
	const key = document.uri.toString();
	if (!cache.has(key)) {
		const text = document.getText();
		const tree = parser.parse(text);
		const version = document.version;
		
		cache.set(key, { tree, version, text });

        updateDiagnostics(document);
	}
}

export function updateTree(event: vscode.TextDocumentChangeEvent) {
	const document = event.document;
	const key = document.uri.toString();
	const version = document.version;

	const cached = cache.get(key);
	if (cached?.version === version) return;

	let oldTree: Tree | undefined;
	if (
		cached &&
		cached.version === version - 1 &&
		canApplyChangesIncrementally(cached.text, event.contentChanges)
	) {
		oldTree = cached.tree;
		const change = event.contentChanges[0];
		oldTree.edit(new Edit(convertToTreeSitterEdit(cached.text, change)));
	}

	const newTree = parser.parse(document.getText(), oldTree);
	cache.set(key, { tree: newTree, version, text: document.getText() });

    updateDiagnostics(document);
}