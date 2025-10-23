const parser = require("./parserWorker")
const { parentPort } = require('worker_threads');

parentPort.on('message', async ({ text, config }) => {
  try {
    const result = parser(text, { maxParsingDepth: config.maxParsingDepth });
    parentPort.postMessage({ result });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
});