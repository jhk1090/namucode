const mainUtils = require('../../mainUtil');
const parser = require('../../parser');
const ivm = require('isolated-vm');

module.exports = async (params, { toHtml, includeData, workspaceDocuments, Store }, obj) => {
    if(includeData) return '';

    const docName = mainUtils.parseDocumentName(obj.splittedParams[0]);
    const doc = workspaceDocuments.find(a => a.namespace === docName.namespace && a.title === docName.title);
    if(!doc) return '';

    const result = await parser(doc.content, {
        noTopParagraph: !obj.topParagraph,
        tokens: doc.parseResult.tokens
    });
    // console.log("parsed result", result.tokens?.length)

    const isolate = new ivm.Isolate({ memoryLimit: 8 });
    const isolateContext = await isolate.createContext();
    const final = await toHtml(result, {
        document: docName,
        includeData: obj.includeData,
        Store: {
            ...Store,
            heading: {
                list: [],
                html: ''
            },
            isolate,
            isolateContext
        }
    });
    // console.log("include result", final.html.length)

    return final.html;
}