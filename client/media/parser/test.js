const { parser } = require(".")
const { toHtml }= require(".")
const fs = require("fs");

const parsed = parser(`[[분류:ㅎㅇ]][[분류:ㅎㅇ2]][[분류:ㅎㅇ3]][[분류:ㅎㅇ4]][[분류:ㅎㅇ5]][[분류:ㅎㅇ6]][[분류:ㅎㅇ7]][[분류:ㅎㅇ8]][[분류:ㅎㅇ9]][[분류:ㅎㅇa]][[분류:ㅎㅇb]][[분류:ㅎㅇc]][[분류:ㅎㅇd]]`)
const html = toHtml(parsed, { document:{ namespace: '문서', title: 'Document' }})

html.then(result => {
	fs.writeFileSync("output.html", result.html)
	console.log(result);
});