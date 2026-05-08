/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HTMLDocumentRegions } from "../embeddedSupport";
import { LanguageMode, Position, Diagnostic, CompletionList } from "../languageModes";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as ts from "typescript";

export function getJSMode(documentRegions: HTMLDocumentRegions): LanguageMode {
  return {
    getId() {
      return "js";
    },
    doValidation(document: TextDocument) {
			const fullRange = {
				start: { line: 0, character: 0 },
				end: document.positionAt(document.getText().length)
			};

			const jsRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'js');

			const allDiagnostics: Diagnostic[] = [];

			jsRegions.forEach(region => {
				const content = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end));
				
				// 좌표 유지를 위해 앞부분을 줄바꿈(\n)으로 채운 가상 문서 생성
				const prefix = document.getText().substring(0, document.offsetAt(region.start)).replace(/[^\r\n]/g, ' ');

				let virtualText = prefix + content
				virtualText = virtualText.replace(/@([^@]+)@/g, "  $1");

				const virtualDoc = TextDocument.create(document.uri, 'js', document.version, virtualText);
				
				const diagnostics = validateSingleFile(virtualDoc);

				// 여기서 나오는 diagnostics는 region의 범위를 넘어서 EOF를 가질 수 없음
				allDiagnostics.push(...diagnostics);
		});

			return allDiagnostics;
		},
    doComplete(document: TextDocument, position: Position, isArgumentCompletion = false) {
      const allSymbols = new Set<string>();

      const fullRange = {
        start: { line: 0, character: 0 },
        end: document.positionAt(document.getText().length)
      };
      const jsRegions = documentRegions.getLanguageRanges(fullRange)
        .filter(r => r.languageId === 'js');

      const embeddedJSSourceFile = documentRegions.getEmbeddedDocument("js")

      jsRegions.forEach(region => {
        const content = document.getText(region);
        
        // TypeScript AST 생성
        const sourceFile = ts.createSourceFile(
          'virtual.js',
          content,
          ts.ScriptTarget.Latest,
          true
        );

        // AST 탐색 함수
        function parseNode(node: ts.Node) {
          if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            if (ts.isIdentifier(node.left)) {
              addSymbol(node.left.text);
            }
          }

          ts.forEachChild(node, parseNode);
        }

        function addSymbol(name: string) {
          if (!allSymbols.has(name)) {
            allSymbols.add(name);
          }
        }

        parseNode(sourceFile);
      });

			const argumentRegions = documentRegions.getLanguageRanges(fullRange)
				.filter(r => r.languageId === 'argument');
			
			argumentRegions.forEach(region => {
				const name = document.getText().substring(document.offsetAt(region.start), document.offsetAt(region.end)).split("@")[1].split("=")[0]
        allSymbols.add(name);
			})

      return !isArgumentCompletion
        ? (getTypeScriptCompletion(embeddedJSSourceFile, position, allSymbols) as CompletionList)
        : {
            isIncomplete: false,
            items: Array.from(allSymbols).map((symbol) => ({
              label: symbol,
              kind: 6,
              insertText: symbol + "@",
            })),
          };
    },
    onDocumentRemoved() {
      /* nothing to do */
    },
    dispose() {
      /* nothing to do */
    },
  };
}

function validateSingleFile(document) {
  const fileName = "virtual.js";
  const content = document.getText();

  const compilerOptions = {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS
  };

  const host = {
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => document.version.toString(),
    getScriptSnapshot: (name) => {
      if (name === fileName) return ts.ScriptSnapshot.fromString(content);
      return undefined;
    },
    getCurrentDirectory: () => "",
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: () => true,
    readFile: () => content,
  };

  const services = ts.createLanguageService(host, ts.createDocumentRegistry());
  const syntax = services.getSyntacticDiagnostics(fileName);
  const semantic = services.getSemanticDiagnostics(fileName);
  
  return [...syntax, ...semantic].map(diag => ({
    range: {
      start: document.positionAt(diag.start),
      end: document.positionAt(diag.start + diag.length)
    },
    message: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
  }));
}

function getTypeScriptCompletion(document, position, allSymbols: Set<string>) {
  const fileName = "virtual.js";

  const virtualDeclarations = Array.from(allSymbols)
      .map(v => `var ${v};`)
      .join(' ');

  const content = virtualDeclarations + document.getText();
  const offset = document.offsetAt(position) +  virtualDeclarations.length;

  const host = {
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => document.version.toString(),
    getScriptSnapshot: (name) => {
      if (name === fileName) return ts.ScriptSnapshot.fromString(content);
      // 내장 라이브러리(lib.d.ts 등) 로드를 위해 필수
      return ts.sys.fileExists(name) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(name)) : undefined;
    },
    getCurrentDirectory: () => "",
    getCompilationSettings: () => ({
      allowJs: true,
      checkJs: false,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS
    }),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
  };

  const languageService = ts.createLanguageService(host, ts.createDocumentRegistry());

  const completions = languageService.getCompletionsAtPosition(fileName, offset, {
    includeExternalModuleExports: false,
    includeInsertTextCompletions: true
  });

  if (!completions) return { isIncomplete: false, items: [] };

  return {
    isIncomplete: false,
    items: completions.entries.map(entry => ({
      label: entry.name,
      kind: convertKind(entry.kind),
      sortText: entry.sortText
    }))
  };
}

function convertKind(tsKind) {
  switch (tsKind) {
    case 'primitive type':
    case 'keyword': return 14; // Keyword
    case 'var':
    case 'let':
    case 'const': return 6;  // Variable
    case 'function': return 3; // Function
    case 'method': return 2;   // Method
    case 'property': return 5; // Field
    case 'class': return 7;    // Class
    case 'interface': return 8; // Interface
    default: return 1;         // Text
  }
}