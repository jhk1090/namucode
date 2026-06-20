import { FoldingRange, TextDocument } from 'vscode-css-languageservice';
import { documentCache } from './server';

export const provideFoldingRanges = (document: TextDocument) => {
	const ranges: FoldingRange[] = []
	
  const targetDepthTypes = ["scaleText", "colorText", "wikiSyntax", "folding", "ifSyntax"];
  const targetFlatTypes = ["syntaxSyntax", "htmlSyntax", "literal", "styleSyntax", "latex"];
  const specialTypes = ["paragraph", "heading", "table", "link", "footnote", "blockquote", "indent", "list"];

  const allTypes = [...targetDepthTypes, ...targetFlatTypes, ...specialTypes];

  const findTargetTypes = (array) => {
    if (array.length === undefined) {
      findTargetTypes([array]);
      return;
    }

    for (const element of array) {
      if (!allTypes.includes(element.type)) continue;

      if (targetDepthTypes.includes(element.type)) {
        const tokStartLine = element.startLine - 1;
        const tokEndLine = element.endLine - 2;
        element.content = element.content ?? [];
        if (tokStartLine < tokEndLine) {
          ranges.push({ startLine: tokStartLine, endLine: tokEndLine });
          for (const content of element.content) {
            findTargetTypes(content);
          }
        }
        continue;
      }
      if (targetFlatTypes.includes(element.type)) {
        const tokStartLine = element.startLine - 1;
        const tokEndLine = element.endLine - 2;
        if (tokStartLine < tokEndLine) {
          ranges.push({ startLine: tokStartLine, endLine: tokEndLine });
        }
        continue;
      }
      if (element.type === "paragraph") {
        for (const line of element.lines ?? []) {
          findTargetTypes(line);
        }
        continue;
      }
      if (element.type === "heading") {
        // heading은 상위에서만 적용됨: startLine == 0
        findTargetTypes(element.content);
        continue;
      }
      if (element.type === "table") {
        for (const row of element.rows) {
          for (const column of row) {
            findTargetTypes(column.value ?? []);
          }
        }
        continue;
      }
      if (element.type === "link") {
        findTargetTypes(element.parsedText ?? []);
        continue;
      }
      if (element.type === "footnote") {
        findTargetTypes(element.value ?? []);
        continue;
      }
      if (element.type === "blockquote") {
        findTargetTypes(element.content ?? []);
        continue;
      }
      if (element.type === "indent") {
        findTargetTypes(element.content ?? []);
        continue;
      }
      if (element.type === "list") {
        for (const item of element.items ?? []) {
          findTargetTypes(item);
        }
        continue;
      }
    }
  };

	const result = documentCache.get(document.uri)?.result?.minified
  let headings = [];
  
  if (result) {
    findTargetTypes(result.result);
    headings = result.data.headings;
  }

  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];

    const startLine = heading.line - 1;
    const endLine = nextHeading ? nextHeading.line - 2 : document.lineCount - 1;

    ranges.push({ startLine, endLine });
  }

  return ranges;
};
