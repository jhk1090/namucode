const parser = require("./core/parser");
const toHtml = require("./core/toHtml");

process.on('message', async (message) => {
    if (message.command === "toHtml") {
        try {
            const { id, parsed, options } = message;
            const result = await toHtml(parsed, options);
    
            process.send({
                id: id,
                status: 'success',
                html: result.html,
                categories: result.categories
            });
    
        } catch (error) {
            console.error(error)
            process.send({
                id: message.id,
                status: 'error',
                message: error instanceof Error ? error.message : '렌더링 중 예기치 않은 오류가 발생했습니다.'
            });
        }

        return
    }
    // if (message.comamnd === "parser") {
    try {
        const { id, text, config } = message;
        const result = await parser(text, config);

        process.send({
            id: id,
            status: 'success',
            parsed: result.parsed,
            html: result.html,
            hasError: result.hasError,
        });

    } catch (error) {
        console.error(error)
        process.send({
            id: message.id,
            status: 'error',
            message: error instanceof Error ? error.message : '파싱 중 예기치 않은 오류가 발생했습니다.'
        });
    }

    //     return
    // }
});

module.exports = {
    parser,
    toHtml,
};
