const parser = require("./utils/newNamumark/parser")
const toHtml = require("./utils/newNamumark/toHtml")
const fs = require("fs");

const parsed = parser(`
== hi ==
`)
const html = toHtml(parsed, { namespace: '문서', title: 'Document' })

html.then(result => {
	fs.writeFileSync("output.html", result.html)
	console.log(result);
});