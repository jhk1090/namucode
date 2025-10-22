const parser = require("./parserWorker")
const { parentPort } = require('worker_threads');

parentPort.on('message', async ({ text }) => {
  try {
    const result = parser(text);
    parentPort.postMessage({ result });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
});