import { URI } from 'vscode-uri';
import { parserCache, previewQuery } from './parser';
import { connection, documents, globalSettings } from './server';
import path from "node:path";
import fs from "node:fs/promises"
import imageSize from 'image-size';
import { TextDocument } from 'vscode-languageserver-textdocument';

const previewParser = require("../../client/media/parser/core/parser.js");
const renderer = require("../../client/media/parser/core/toHtmlWorker.js");

interface PreviewParser {
	value: any,
	version: number,
	isEditorComment: boolean,
	maxParsingDepth: number
}
export const previewParserCache = new Map<string, PreviewParser>;

export const previewWorkspaceDocumentsCache = new Map<string, any[]>;

interface PreviewRenderer {
	value: Promise<any>,
	maxRenderingTimeout: number,
	internalLinkDomain: string,
	maxLength: number,
	includeData: Record<string, string>
}
export const previewRendererCache = new Map<string, PreviewRenderer>;

function getParsed(document: TextDocument, isEditorComment: boolean) {
	const cached = previewParserCache.get(document.uri);
	const shouldReparse = 
		!cached ||
		cached.isEditorComment !== isEditorComment ||
		cached.maxParsingDepth !== globalSettings.maxParsingDepth ||
		cached.version !== document.version

	if (shouldReparse) {
		const parsed = previewParser(document.getText(), { editorComment: isEditorComment, maxParsingDepth: globalSettings.maxParsingDepth })
		previewParserCache.set(document.uri, {
			value: parsed,
			version: document.version,
			isEditorComment,
			maxParsingDepth: globalSettings.maxParsingDepth
		})
		previewWorkspaceDocumentsCache.delete(document.uri);
		previewRendererCache.delete(document.uri);
		// console.log("parsed: 다시")
		return parsed
	}
	
	// console.log("parsed: 재활용")
	return cached.value
}

function getMimeType(imagePath: string): string {
    const extension = path.extname(imagePath).toLowerCase();
    switch (extension) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.webp': return 'image/webp';
        default: return 'application/octet-stream'; // 알 수 없는 타입
    }
}

async function getImageInfo(imagePath: string) {
    const stats = await fs.stat(imagePath);
    const buffer = await fs.readFile(imagePath);
    const { width, height } = imageSize(buffer);

    return {
        fileWidth: width,
        fileHeight: height,
        fileSize: stats.size,
    };
}

async function imagePathToDataUri(imagePath: string): Promise<string> {
	const mimeType = getMimeType(imagePath);

	if (mimeType === 'application/octet-stream') {
			throw new Error('Unsupported image file type.');
	}

	return new Promise(async (resolve, reject) => {
			try {
					const data = await fs.readFile(imagePath);
					const base64Data = data.toString('base64');
					const dataUri = `data:${mimeType};base64,${base64Data}`;
					
					resolve(dataUri);
			} catch (err) {
					reject(new Error(`Failed to read file: ${err.message}`));
			}
	});
}

async function getWorkspaceResources(document: TextDocument, folderPath: string) {
	const cached = previewWorkspaceDocumentsCache.get(document.uri);
	if (cached) {
		// console.log("workspaceResources: 재활용")
		return cached
	};

	const tree = parserCache.get(document.uri)?.tree;
	if (!tree) return [];
	
	const allowedExtnames = [".namu", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"]
	const entries = (
		await fs.readdir(folderPath, {
			withFileTypes: true,
		})
	)
		.filter((entry) => 
			entry.isFile() && 
			allowedExtnames.includes(path.extname(entry.name))
		)
		.map(entry => path.join(folderPath, entry.name))

	let targetEntries: string[] = [];
	for (const { name, node } of previewQuery.captures(tree.rootNode)) {
		let filename = "";
		if (name === "file_link") {
			if (node.children.find(child => child.type === "argument")) continue;

			filename = node.text.slice(3);
		}
		else if (name === "include_macro") {
			if (node.children.find(child => child.type === "argument")) continue;

			const content = node.namedChild(2);
			const firstCommaRegex = /(?<!\\)(?:\\\\)*,/;
			const match = content.text.match(firstCommaRegex)

			filename = match ? content.text.slice(0, match.index) : content.text
			filename += ".namu"
		}

		const targetEntry = entries.find(entry => path.relative(folderPath, entry) === filename)
		if (targetEntry) {
			targetEntries.push(targetEntry)
		}
	}

	const resources = [];
	for (const entry of targetEntries) {
		if (path.extname(entry) === ".namu") {
			let title = path.relative(folderPath, entry);
			title = title.replace(/\\/g, "/");

			resources.push(
				{
					namespace: "문서",
					title: title.slice(0, -(".namu".length)),
					content: await fs.readFile(entry, "utf-8")
				}
			)
		}
		else {
			let title = path.relative(folderPath, entry);
			title = title.replace(/\\/g, "/");

			const fileKey = await imagePathToDataUri(entry);
			const { fileHeight, fileWidth, fileSize } = await getImageInfo(entry);

			resources.push(
				{
					namespace: "문서",
					title: "파일:" + title,
					content: {
						fileKey,
						fileWidth,
						fileHeight,
						fileSize
					}
				}
			)
		}
	}

	resources.sort((a, b) => a.namespace.localeCompare(b.namespace));
	resources.sort((a, b) => a.title.localeCompare(b.title));

	previewWorkspaceDocumentsCache.set(document.uri, resources);
	previewRendererCache.delete(document.uri);

	// console.log("workspaceResources: 다시")
	return resources;
}

async function getRendered(document: TextDocument, includeData: Record<string, string>, folderPath: string, parsed: any, workspaceDocuments) {
	const cached = previewRendererCache.get(document.uri);
	const shouldRerender = 
		!cached ||
		cached.maxRenderingTimeout !== globalSettings.maxRenderingTimeout ||
		cached.internalLinkDomain !== globalSettings.internalLinkDomain ||
		cached.maxLength !== globalSettings.maxLength ||
		JSON.stringify(cached.includeData) !== JSON.stringify(includeData)

	if (!shouldRerender) {
		// console.log("rendered: 재활용")
		return cached.value
	}

	const promise = new Promise(async (resolve, _) => {
		let timeout: NodeJS.Timeout | null = null;
		let terminator = new AbortController();
		if (globalSettings.maxRenderingTimeout && globalSettings.maxRenderingTimeout > 0) {
			timeout = setTimeout(() => {
				terminator.abort();
			}, globalSettings.maxRenderingTimeout)
		}

		let result;
		try {
			let title = path.relative(folderPath, URI.parse(document.uri).fsPath);
			title = title.replace(/\\/g, "/");
	
			const targetDocument = { 
				namespace: "문서", 
				title: title.slice(0, -(".namu".length)), 
				forceShowNamespace: null
			}
			
			result = {
				...await renderer(
					[
						structuredClone(parsed), 
						{ 
							document: targetDocument, 
							workspaceDocuments, 
							config: {
								internalLinkDomain: globalSettings.internalLinkDomain,
								maxLength: globalSettings.maxLength,
								maxParsingDepth: globalSettings.maxParsingDepth,
								extensionPath: process.env.NAMUCODE_EXTENSION_PATH
							}, 
							includeData, 
							signal: terminator.signal
						}
					]
				),
				workspaceDocuments
			}
		} catch (err) {
			const isTimeout = err.message == "Timeout";
			const isTooLong = err.message == "render_too_long";
			const isAborted = err.message == "Abort";
			if (!isTimeout) console.error(err);
	
			result = {
				html: "",
				categories: [],
				error: true,
				errorCode: isAborted ? "aborted" : isTimeout ? "render_timeout" : isTooLong ? "render_too_long" : "render_failed",
				errorMessage: err.stack,
				workspaceDocuments
			};
		}

		clearTimeout(timeout);
		resolve(result);
	})

	previewRendererCache.set(document.uri, {
		value: promise,
		maxRenderingTimeout: globalSettings.maxRenderingTimeout,
		internalLinkDomain: globalSettings.internalLinkDomain,
		maxLength: globalSettings.maxLength,
		includeData
	})
	// console.log("rendered: 다시")
	return promise;
}

export async function getPreviewData(uri: string, isEditorComment: boolean, includeData: Record<string, string>) {
	const document = documents.get(uri);
	const parsed = getParsed(document, isEditorComment)

	const workspaceDocuments = [];
	const targetFolders = await connection.workspace.getWorkspaceFolders();
	const folderPath = targetFolders?.length ? URI.parse(targetFolders[0].uri).fsPath : path.dirname(URI.parse(uri).fsPath);
	if (targetFolders?.length && globalSettings.workspaceReference) {
		workspaceDocuments.push(...await getWorkspaceResources(document, folderPath));
	}

	const rendered = await getRendered(
		document,
		includeData,
		folderPath,
		parsed,
		workspaceDocuments
	)

	if (rendered.error) {
		previewRendererCache.delete(document.uri);
	}

	return rendered
}