const { parser } = require(".")
const { toHtml }= require(".")
const fs = require("fs");

const parsed = parser(`
[youtube(-3Xr6dOezs8)]
[youtube(C8uSFs01qwc)]
[youtube(KSJl4A9eUW4)]
[youtube(nHdEUIPpS2k)]
`)
const html = toHtml(parsed, { namespace: '문서', title: 'Document' })

html.then(result => {
	fs.writeFileSync("output.html", result.html)
	console.log(result);
});