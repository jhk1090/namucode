const Piscina = require('piscina');
const os = require('os');

let MAXIMUM_TIME = 7000;
const ERROR_HTML = '문서 파싱에 실패했습니다.';
const MAXIMUM_TIME_HTML = '문서 파싱이 너무 오래 걸립니다.';

let minThreads = 1
let maxThreads = 1

module.exports = async (...params) => {
    if (params[1]?.maxParsingTimeout) {
        MAXIMUM_TIME = params[1].maxParsingTimeout
    }

    const controller = new AbortController();
    
    const timeout = setTimeout(() => {
        controller.abort()
    }, MAXIMUM_TIME)

    const worker = new Piscina({
        filename: require.resolve('./parserWorker'),
        minThreads,
        maxThreads
    });
    const channel = new MessageChannel();

    console.time('parse');
    try {
        const result = await worker.run(params[0], {
            signal: controller.signal,
            transferList: [channel.port1]
        });
        clearTimeout(timeout)
        return {
            parsed: result,
            html: null,
            hasError: false
        }

    } catch (e) {
        const isTimeout = e.name === 'AbortError';
        if(!isTimeout) console.error(e);

        const errorMsg = isTimeout ? MAXIMUM_TIME_HTML : ERROR_HTML;
        clearTimeout(timeout)
        return {
            parsed: null,
            html: `<h2>${errorMsg}</h2>`,
            errorCode: isTimeout ? "parsing_timeout" : "parsing_failed",
            errorMessage: e.stack,
            hasError: true
        }
    } finally {
        console.timeEnd('parse');
    }
}