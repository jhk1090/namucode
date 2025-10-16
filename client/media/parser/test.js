const { parser } = require(".")
const { toHtml }= require(".")
const fs = require("fs");

const parsed = parser(`
[[분류:나무위키의 도움말]]
[include(틀:하위 문서, 문서명1=나무위키:문법 도움말/심화, 문서명2=나무위키:문법 도움말/개발)]
[include(틀:나무위키)]
[include(틀:나무위키 도움말)]

[목차]
== 개요 ==
[[나무위키]]의 문법 도움말입니다. [[the seed|나무위키가 사용하는 위키 엔진]]이 제공하는 문법이라 하여 '나무마크'라고도 합니다.

이 문서에서는 기본적인 수준의 위키 [[문법]]들을 정리했으며, [[나무위키:문법 도움말/심화]] 문서에서 고급 문법을 확인하실 수 있습니다. [[나무위키:문법 도움말/개발]] 문서에서는 위키 문법을 처리하는 원리 등을 설명합니다.[* 테스트]
`)
const html = toHtml(parsed, { namespace: '문서', title: 'Document' })

html.then(result => {
	fs.writeFileSync("output.html", result.html)
	console.log(result);
});