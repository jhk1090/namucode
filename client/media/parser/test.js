const { parser } = require(".")
const { toHtml }= require(".")
const fs = require("fs");

const parsed = parser(``)
const html = toHtml(parsed, { document:{ namespace: '문서', title: 'Document' }})

html.then(result => {
	fs.writeFileSync("output.html", result.html)
	console.log(result);
});