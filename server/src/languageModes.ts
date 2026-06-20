/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getCSSLanguageService } from 'vscode-css-languageservice';
import {
	CompletionList,
	Diagnostic,
	getLanguageService as getHTMLLanguageService,
	Position,
	Range,
} from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getCSSMode } from './modes/cssMode';
import { getDocumentRegions } from './embeddedSupport';
import { getCSSInlineMode } from './modes/cssInlineMode';
import { getJSMode } from './modes/jsMode';

export * from 'vscode-html-languageservice';
export const MODES_LENGTH = 6;

export interface LanguageModeCompletionOptions {
	isArgumentCompletion?: boolean;
  isOnclickCompletion?: boolean;
	[key: string]: any;
}

export interface LanguageMode {
	getId(): string;
	doValidation?: (document: TextDocument) => Diagnostic[];
	doComplete?: (document: TextDocument, position: Position, options?: LanguageModeCompletionOptions) => CompletionList | null;
	onDocumentRemoved(): void;
	dispose(): void;
}

export interface LanguageModes {
	getModeAtPosition(position: Position): LanguageMode | undefined;
	getModesInRange(range: Range): LanguageModeRange[];
	getAllModes(): LanguageMode[];
	getAllModesInDocument(): LanguageMode[];
	getMode(languageId: string): LanguageMode | undefined;
	onDocumentRemoved(): void;
	dispose(): void;
}

export interface LanguageModeRange extends Range {
	mode: LanguageMode | undefined;
	attributeValue?: boolean;
}

export const cssLanguageService = getCSSLanguageService({
			customDataProviders: [
				{
					provideAtDirectives: () => [
						{
							name: '@theseed-dark-mode',
							description: '다크 모드 전용 스타일을 정의합니다.',
						}
					],
					provideProperties: () => [],
					providePseudoClasses: () => [],
					providePseudoElements: () => []
				}
			]
	});

export function getLanguageModes(documentSymbol: Record<string, any>, document: TextDocument): LanguageModes {
	const documentRegions = getDocumentRegions(document, documentSymbol)

	let modes = Object.create(null);

	const baseModeConfig = (id: string): LanguageMode => ({
		getId: () => id,
		doValidation: () => [],
		doComplete: () => null,
		onDocumentRemoved: () => {},
		dispose: () => {}
	})
	// modes 개수 변경 시 MODES_LENGTH 변경 필요
	modes['css'] = getCSSMode(cssLanguageService, documentRegions);
	modes['css-inline'] = getCSSInlineMode(cssLanguageService, documentRegions);
	modes['js'] = getJSMode(documentRegions);
	modes['argument'] = baseModeConfig("argument")

	// 자연스러운 자동완성을 위한 모드
	modes['wiki-style-for-completion'] = getCSSInlineMode(cssLanguageService, documentRegions)
	modes['wiki-dark-style-for-completion'] = getCSSInlineMode(cssLanguageService, documentRegions)


	return {
		getModeAtPosition(
			position: Position
		): LanguageMode | undefined {
			const languageId = documentRegions.getLanguageAtPosition(position);
			if (languageId) {
				return modes[languageId];
			}
			return undefined;
		},
		getModesInRange(range: Range): LanguageModeRange[] {
			return documentRegions
				.getLanguageRanges(range)
				.map((r): LanguageModeRange => {
					return {
						start: r.start,
						end: r.end,
						mode: r.languageId && modes[r.languageId],
						attributeValue: r.attributeValue
					};
				});
		},
		getAllModesInDocument(): LanguageMode[] {
			const result = [];
			for (const languageId of documentRegions.getLanguagesInDocument()) {
				const mode = modes[languageId];
				if (mode) {
					result.push(mode);
				}
			}
			return result;
		},
		getAllModes(): LanguageMode[] {
			const result = [];
			for (const languageId in modes) {
				const mode = modes[languageId];
				if (mode) {
					result.push(mode);
				}
			}
			return result;
		},
		getMode(languageId: string): LanguageMode {
			return modes[languageId];
		},
		onDocumentRemoved() {
			for (const mode in modes) {
				modes[mode].onDocumentRemoved();
			}
		},
		dispose(): void {
			for (const mode in modes) {
				modes[mode].dispose();
			}
			modes = {};
		}
	};
}
