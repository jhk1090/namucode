const parser = require("./core/parser");
const toHtml = require("./core/toHtml");

process.on("message", async (message) => {
    if (message.command === "toHtml") {
        const { id, parsed, options } = message;
        try {
            const result = await toHtml(parsed, options/* , controller.signal */);

            process.send({
                id: id,
                status: "success",
                html: result.html,
            });
        } catch (error) {
            console.error(error)
            process.send({
                id: id,
                status: "error",
                message: error.message,
            });
        }
        return
    }
    if (message.command === "parser") {
        const { id, text } = message;
        try {
            const result = parser(text);

            process.send({
                id: id,
                status: "success",
                parsed: result,
            });
        } catch (error) {
            console.error(error)
            process.send({
                id: id,
                status: "error",
                message: error.message,
            });
        }
        return
    }
});

module.exports = {
    parser,
    toHtml,
};
