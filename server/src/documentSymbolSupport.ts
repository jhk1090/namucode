import { DocumentSymbol, Range, SymbolKind, TextDocument } from 'vscode-css-languageservice';
import { documentCache } from './server';

// export class TreeSymbol extends DocumentSymbol {
//   depth: number;
//   children: TreeSymbol[];

//   constructor(name: string, detail: string, kind: SymbolKind, range: vscode.Range, selectionRange: vscode.Range, depth: number) {
//     super(name, detail, kind, range, selectionRange);
//     this.depth = depth;
//   }
// }
export interface TreeSymbol extends DocumentSymbol {
	name: string;
	detail: string;
	kind: SymbolKind;
	range: Range;
	selectionRange: Range;
	depth: number;
  children: TreeSymbol[];
}

interface Heading {
  line: number;
  level: number;
  closed: boolean;
  sectionNum: number;
  numText: string;
  pureText: { type: "text"; text: string; }[];
  actualLevel: number;
}

export const provideDocumentSymbol = (document: TextDocument, parsedResult: any) => {
  function makeTreeSymbol(heading: Heading): TreeSymbol {
    const line = heading.line - 1

    const lineText = document.getText().split(/\r?\n/)[line];
    const lineRange = {
      start: { line, character: 0 },
      end: { line, character: lineText.length }
    }

    return {
      name: `${heading.numText}. ${heading.pureText.map(p => p.text).join("")}`,
      detail: "",
      kind: SymbolKind.String,
      range: lineRange,
      selectionRange: lineRange,
      depth: heading.level,
      children: []
    }
  }

  const rawHeadings: Heading[] = parsedResult.data.headings;
  
  function buildHeadingTree(headings: Heading[]): TreeSymbol[] {
    const root: TreeSymbol[] = [];
    const stack: TreeSymbol[] = [];

    headings.forEach((heading) => {
      const node: TreeSymbol = makeTreeSymbol(heading);

      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    return root;
  }

  return buildHeadingTree(rawHeadings);
};
