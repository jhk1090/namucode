const { getQuickJS } = require('quickjs-emscripten');
const mainUtils = require('../../mainUtil');
const parser = require('../../parserWorker');

module.exports = async (params, { toHtml, includeData, workspaceDocuments, Store }, obj) => {
    if(includeData) return '';

    const docName = mainUtils.parseDocumentName(obj.splittedParams[0]);
    const doc = workspaceDocuments.find(a => a.namespace === docName.namespace && a.title === docName.title);
    if(!doc) return '';

    const result = parser(doc.content, {
        noTopParagraph: !obj.topParagraph,
        tokens: doc.parseResult.tokens,
        maxParsingDepth: Store.config.maxParsingDepth ?? null
    });
    // console.log("parsed result", result.tokens?.length)

    const qjs = await getQuickJS();
    const qjsContext = qjs.newContext();
    const final = await toHtml(result, {
        document: docName,
        includeData: obj.includeData,
        Store: {
            ...Store,
            heading: {
                list: [],
                html: ''
            },
            footnote: {
                index: 0,
                values: [],
                list: []
            },
            qjs,
            qjsContext
        }
    });
    // console.log("include result", final.html.length)

    return final.html;
}