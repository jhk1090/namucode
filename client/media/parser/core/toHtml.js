const toHtml = require("./toHtmlWorker")
const { parentPort } = require('worker_threads');

parentPort.on('message', async (params) => {
  try {
    const result = await toHtml([params.parsedResult, { document: params.document, workspaceDocuments: params.workspaceDocuments, config: params.config }]);
    parentPort.postMessage({ result });
  } catch (err) {
    console.error("asdf", err)
    parentPort.postMessage({ error: err.message });
  }
});