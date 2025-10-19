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
                message: error instanceof Error ? error.message : 'Unknown error during toHtml execution.'
            });
        }

        return
    }
    // if (message.comamnd === "parser") {
    try {
        const { id, text } = message;
        const result = parser(text);

        process.send({
            id: id,
            status: 'success',
            parsed: result
        });

    } catch (error) {
        console.error(error)
        process.send({
            id: message.id,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error during toHtml execution.'
        });
    }

    //     return
    // }
});

module.exports = {
    parser,
    toHtml,
};
