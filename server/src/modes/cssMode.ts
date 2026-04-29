/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageService as CSSLanguageService } from 'vscode-css-languageservice';
import { HTMLDocumentRegions } from '../embeddedSupport';
import { LanguageMode, Position } from '../languageModes';

export function getCSSMode(
	cssLanguageService: CSSLanguageService,
	documentRegions: HTMLDocumentRegions
): LanguageMode {
	return {
		getId() {
			return 'css';
		},
		doValidation() {
			// Get virtual CSS document, with all non-CSS code replaced with whitespace
			const embedded = documentRegions.getEmbeddedDocument('css');
			const stylesheet = cssLanguageService.parseStylesheet(embedded);
			return cssLanguageService.doValidation(embedded, stylesheet);
		},
		doComplete(position: Position) {
			// Get virtual CSS document, with all non-CSS code replaced with whitespace
			const embedded = documentRegions.getEmbeddedDocument('css');
			const stylesheet = cssLanguageService.parseStylesheet(embedded);
			return cssLanguageService.doComplete(embedded, position, stylesheet);
		},
		onDocumentRemoved() { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
