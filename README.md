# 나무코드 Namucode

[나무위키](https://namu.wiki)의 Monaco 편집기의 VSCode 확장 프로그램 버전입니다. 많은 기능이 추가될 예정입니다.

- [나무코드 Namucode](#나무코드-namucode)
  - [설치](#설치)
  - [사용법](#사용법)
  - [기능](#기능)
    - [텍스트 강조 기능 (Syntax Highlighting)](#텍스트-강조-기능-syntax-highlighting)
    - [코드 분석 기능 (Linting)](#코드-분석-기능-linting)
    - [자동완성 기능 (Snippet)](#자동완성-기능-snippet)
    - [커맨드 기능 (Command Palette)](#커맨드-기능-command-palette)
    - [목차 표시 기능 (Table of Contents)](#목차-표시-기능-table-of-contents)
  - [업데이트 로그](#업데이트-로그)
  - [참고](#참고)

![namucode_oneditor](https://user-images.githubusercontent.com/72603240/177030474-b7355ad7-83a2-4c6c-a39c-54ed28ead3f2.jpg)

## 설치

나무코드는 VSCode 확장 프로그램으로, [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=jhk1090.namucode)에서 다운받을 수 있습니다.

## 사용법

1. 나무코드를 설치합니다. (상단 설치 링크)
1. 설치 후 언어칸에서 '나무마크'를 선택하거나 파일 확장자를 `.namu`로 바꿔줍니다.
1. 설정이 끝났으며 나무마크 문법을 사용해보세요!\
   \
   예시: [나무위키(namuwiki.namu) 문서](https://github.com/jhk1090/namucode/blob/main/src/namuwiki.namu)

![namucode_onlanguageselect](https://user-images.githubusercontent.com/72603240/177031047-5ac630d1-f218-4a92-88bb-68a8453d8a35.png)
_▲ 선택란_

## 기능

### 텍스트 강조 기능 (Syntax Highlighting)

나무코드는 텍스트 강조를 지원합니다.\
기존 에디터보다 더 세세한 강조가 지원됩니다.

---

나무위키의 '나무위키' 문서 비교샷

- 나무위키 내부 편집기
  ![namucode_origin](https://user-images.githubusercontent.com/72603240/177030481-020df8da-1b36-4b11-b1c2-f3ecf6e7c32a.jpg)
- 나무코드
  ![namucode_vscode](https://user-images.githubusercontent.com/72603240/177030487-f90f862d-e264-49d6-b935-137fb6154905.png)

### 코드 분석 기능 (Linting)

간단한 분석을 통해 교정할 수 있는 문법 등을 강조 표시합니다.
현재 코드 분석을 통해 강조를 지원하는 구문은 다음과 같습니다.

- **고정 주석 강조** - `##@`를 사용한 고정 주석을 강조합니다.
- **비권장 문법 경고 표시** - 나무위키에서 권장하지 않는 문법을 사용한 경우 경고 표시합니다.
  - 1단계 문단 경고

### 자동완성 기능 (Snippet)

나무코드는 편의를 위한 자동완성을 지원합니다.\
쉽게 `ctrl+space`로 자동완성 목록을 볼 수 있습니다.\
현재 자동완성 목록은 다음과 같습니다.

- **child** - 하위 문서 틀을 삽입합니다.
- **contentmoved** - 문서 가져옴 틀을 삽입합니다.
- **detail** - 상세 내용 틀을 삽입합니다.
- **detailanchor** - 상세 내용 틀을 앵커와 함께 삽입합니다.
- **detailparagraph** - 상세 내용 틀을 문단 번호와 함께 삽입합니다.
- **file** - 파일을 삽입합니다.
- **folding** - [ 펼치기 · 접기 ] 문법을 삽입합니다.
- **include** - 틀을 삽입합니다.
- **link** - 링크할 문서명과 문서에서 보여지는 명칭이 있는 링크를 생성합니다.
- **navertv** - 네이버TV 영상을 삽입합니다.
- **parent** - 상위 문서 틀을 삽입합니다.
- **relate** - 관련 문서 틀을 삽입합니다.
- **youtube** - 유튜브 영상을 삽입합니다.

### 커맨드 기능 (Command Palette)

여기서 커맨드는 `F1`시 나오는 커맨드 팔레트의 커맨드들을 지칭합니다.\
`F1`을 눌러 아래의 목록을 검색하거나 단축키를 이용하면 적용됩니다.\
커맨드 목록은 다음과 같습니다.

- **문단 한단계 높이기** `ctrl+↑(up)` - 선택한 범위 내에서 문단을 한단계 높인다.\
  == 개요 == → === 개요 ===
- **문단 한단계 낮추기** `ctrl+↓(down)` - 선택한 범위 내에서 문단을 한단계 낮춘다.\
  === 개요 === → == 개요 ==
- **문자 링크화하기** - 선택한 문자를 링크로 만든다.
  선택 -> [[선택]]

### 목차 표시 기능 (Table of Contents)

편집기 왼쪽 탐색기 탭에서 확인할 수 있으며, 문단 제목의 내용을 그대로 가져와 '개요' 란에 표시합니다.\
목차 클릭시 클릭한 목차로 이동됩니다.

![namucode_tableofcontent](https://user-images.githubusercontent.com/72603240/178151612-0395c438-57f3-4789-a497-b4cd6331bc91.png)
_▲ 나무위키:문법 도움말_

## 업데이트 로그

업데이트 로그는 [여기](https://github.com/jhk1090/namucode/blob/main/CHANGELOG.md)를 참고하세요.

## 참고

- [나무위키 문법 도움말](https://namu.wiki/w/나무위키:문법%20도움말)
- [Textmate Grammar](https://macromates.com/manual/en/language_grammars)
- [VSCode Extension Sample](https://github.com/microsoft/vscode-extension-samples)
