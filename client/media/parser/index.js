const parser = require("./core/parser");
const toHtml = require("./core/toHtml");

process.on("message", async (message) => {
    if (message.command === "toHtml") {
        const { id, parsed, options } = message; // ID를 사용하여 응답을 특정 요청과 연결

        try {
            // toHtml 함수 실행
            const result = await toHtml(parsed, options);

            // 결과를 부모 프로세스에 ID와 함께 전송
            process.send({
                id: id,
                status: "success",
                html: result.html,
            });
        } catch (error) {
            // 오류 발생 시 오류 메시지 전송
            process.send({
                id: id,
                status: "error",
                message: error.message,
            });
        }
    }
});

module.exports = {
    parser,
    toHtml,
};
