const Piscina = require('piscina');
const os = require('os');

let MAXIMUM_TIME = 10000;
const ERROR_HTML = '문서 렌더링이 실패했습니다.';
const MAXIMUM_TIME_HTML = '문서 렌더링이 너무 오래 걸립니다.';

let minThreads = parseInt(process.env.MULTITHREAD_MIN_THREADS);
if(isNaN(minThreads) || minThreads < 1) minThreads = Math.min(4, os.cpus().length);
let maxThreads = parseInt(process.env.MULTITHREAD_MAX_THREADS);
if(isNaN(maxThreads) || maxThreads < 1) maxThreads = Math.max(4, os.cpus().length);

module.exports = async (...params) => {
    if (params[1]?.config?.maxTimeout) {
        MAXIMUM_TIME = params[1]?.config?.maxTimeout
    }

    const controller = new AbortController();
    
    setTimeout(() => {
        controller.abort()
    }, MAXIMUM_TIME)

    const worker = new Piscina({
        filename: require.resolve('./toHtmlWorker'),
        minThreads,
        maxThreads
    });
    const channel = new MessageChannel();

    console.time('render');
    try {
        return await worker.run(params, {
            signal: controller.signal,
            transferList: [channel.port1]
        });
    } catch (e) {
        const isTimeout = e.name === 'AbortError';
        if(!isTimeout) console.error(e);

        const errorMsg = isTimeout ? MAXIMUM_TIME_HTML : ERROR_HTML;
        return {
            html: `<h2>${errorMsg}</h2>`,
            errorMsg,
            errorCode: isTimeout ? 'render_timeout' : 'render_failed',
            links: [],
            files: [],
            categories: [],
            headings: [],
            hasError: true,
            embed: {
                text: null,
                image: null
            }
        }
    } finally {
        console.timeEnd('render');
    }
}