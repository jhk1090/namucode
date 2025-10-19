const vscode = acquireVsCodeApi();

document.addEventListener("click", function (e) {
    // hashChange가 한국어 hash에서는 작동하지 않는 오류 해결 + toc -> wiki-macro-toc
    if (e.target.tagName === "A" && e.target.getAttribute("href").startsWith("#")) {
        e.preventDefault();

        const href = e.target.getAttribute("href");
        const targetId = href.slice(1);

        const decodedId = decodeURIComponent(targetId);

        if (decodedId == "toc") {
            document.getElementsByClassName("wiki-macro-toc")[0]?.scrollIntoView();
            return;
        }

        const anchorElem = document.getElementById(decodedId);
        anchorElem?.scrollIntoView();
    }
});
