# 나무코드 Namucode

[나무위키](https://namu.wiki)의 Monaco 편집기의 VSCode 확장 프로그램 버전입니다. 많은 기능이 추가될 예정입니다.

- [나무코드 Namucode](#나무코드-namucode)
  - [설치](#설치)
  - [사용법](#사용법)
  - [기능](#기능)
    - [텍스트 강조 기능 (Syntax Highlighting)](#텍스트-강조-기능-syntax-highlighting)
    - [코드 분석 기능 (Linting)](#코드-분석-기능-linting)
    - [미리보기 (Preview)](#미리보기-preview)
    - [문단 자동 정렬 기능 (Auto-Sorting Paragraph)](#문단-자동-정렬-기능-auto-sorting-paragraph)
    - [자동완성 기능 (Snippet)](#자동완성-기능-snippet)
    - [커맨드 기능 (Command Palette)](#커맨드-기능-command-palette)
    - [목차 표시 기능 (Table of Contents)](#목차-표시-기능-table-of-contents)
  - [저작권 고지](#저작권-고지)
  - [기여](#기여)
  - [업데이트 로그](#업데이트-로그)
  - [참고](#참고)

![namucode_oneditor](./images/namucode_oneditor.png)

## 설치

나무코드는 VSCode 확장 프로그램으로, [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=jhk1090.namucode)에서 다운받을 수 있습니다.

## 사용법

1. 나무코드를 설치합니다. (상단 설치 링크)
1. 설치 후 언어칸에서 '나무마크'를 선택하거나 파일 확장자를 `.namu`로 바꿔줍니다.
1. 설정이 끝났으며 나무마크 문법을 사용해보세요!

| ![namucode_onlanguageselect](./images/namucode_onlanguageselect.png) |
| :----: |
| 선택란 |

## 기능

### 텍스트 강조 기능 (Syntax Highlighting)

나무코드는 텍스트 강조를 지원합니다.\
기존 에디터보다 더 세세한 강조가 지원됩니다.

| ![namucode_origin](./images/namucode_origin.jpg) | ![namucode_vscode](./images/namucode_vscode.png) |
| :----: | :----: |
| 나무위키 편집기 | **나무코드 편집기** |
  

### 코드 분석 기능 (Linting)

간단한 분석을 통해 교정할 수 있는 문법 등을 강조 표시합니다.
현재 코드 분석을 통해 강조를 지원하는 구문은 다음과 같습니다.

<!-- - **고정 주석 강조** - `##@`를 사용한 고정 주석을 강조합니다. -->
- **비권장 문법 경고 표시** - 나무위키에서 권장하지 않는 문법을 사용한 경우 경고를 표시합니다.
  - 1단계 문단 경고
- **인용문 오류 표시** - 인용문은 8단계 이상 중첩할 수 없습니다. 만약 사용한 경우 오류를 표시합니다.

### 미리보기 (Preview)
#### 개발 중인 기능입니다. 일부 문법이 꺠지거나 불안정 할 수 있습니다.
나무코드는 미리보기를 지원합니다.\
`F1`을 눌러 **나무코드: 미리보기** 옵션을 누르거나 `*.namu` 파일의 오른쪽 상단에 위치한 미리보기 아이콘을 눌러 미리보기를 조회할 수 있습니다.\
**개발 중인 기능**으로 1000줄까지만 렌더링을 지원합니다! (그 이상은 파서 성능이..)

| ![Image](./images/namucode_preview_icon.png) | ![Image](./images/namucode_preview_example.png) |
| :----: | :----: |
| 미리보기 아이콘 | 미리보기 예시 |

### 문단 자동 정렬 기능 (Auto-Sorting Paragraph)
나무코드는 문단 자동 정렬 기능을 지원합니다.\
`F1`을 눌러 **나무코드: 문단 자동 정렬** 옵션을 누르거나 `*.namu` 파일의 오른쪽 상단에 위치한 문단 자동 정렬 아이콘을 눌러 미리보기를 조회할 수 있습니다.

| ![Image](./images/namucode_sort_icon.png) |
| :----: |
| 문단 자동 정렬 아이콘

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
- **include**, **xmf** - 틀을 삽입합니다.
- **link** - 링크할 문서명과 문서에서 보여지는 명칭이 있는 링크를 생성합니다.
- **navertv** - 네이버TV 영상을 삽입합니다.
- **parent** - 상위 문서 틀을 삽입합니다.
- **relate** - 관련 문서 틀을 삽입합니다.
- **youtube**, **yt** - 유튜브 영상을 삽입합니다.
- **if** - if 문법을 삽입합니다.
- **wikistyle**, **ws** - wiki style 문법을 삽입합니다.
- **wikistyledark**, **wsd** - wiki style 문법을 삽입합니다. (dark-style 포함)
- **syntax** - 문법 강조 구문을 삽입합니다.
- **HTML** - HTML 구문을 삽입합니다.
- **h\<n\>** - \<n\>단계 문단을 삽입합니다.
- **h\<n\>f** - \<n\>단계 접힌 문단을 삽입합니다.

### 커맨드 기능 (Command Palette)

여기서 커맨드는 `F1`시 나오는 커맨드 팔레트의 커맨드들을 지칭합니다.\
`F1`을 눌러 아래의 목록을 검색하거나 단축키를 이용하면 적용됩니다.\
커맨드 목록은 다음과 같습니다.

- **문단 한단계 높이기** `ctrl`(`cmd`)+`↑` - 선택한 범위 내에서 문단을 한단계 높인다.\
  == 개요 == → === 개요 ===
- **문단 한단계 낮추기** `ctrl`(`cmd`)+`↓` - 선택한 범위 내에서 문단을 한단계 낮춘다.\
  === 개요 === → == 개요 ==
- **텍스트 링크** `ctrl`(`cmd`)+`shift`+`K` - 선택한 문자를 링크로 만든다.
  선택 -> [[선택]]
- **텍스트 굵게** `ctrl`(`cmd`)+`B` - 선택한 문자를 굵게 만든다.
- **텍스트 기울임** `ctrl`(`cmd`)+`I` - 선택한 문자를 기울임꼴로 만든다.
- **텍스트 밑줄** `ctrl`(`cmd`)+`U` - 선택한 문자를 밑줄로 만든다.
- **텍스트 취소선** `ctrl`(`cmd`)+`shift`+`D` - 선택한 문자를 취소선으로 만든다.
- **텍스트 위첨자** `ctrl`(`cmd`)+`shift`+`U` - 선택한 문자를 위첨자로 만든다.
- **텍스트 아래첨자** `ctrl`(`cmd`)+`shift`+`Y` - 선택한 문자를 아래첨자로 만든다.
- **문단 자동 정렬 기능** `ctrl`(`cmd`)+`k` `ctrl`(`cmd`)+`s` - [문단 자동 정렬 기능](#문단-자동-정렬-기능-auto-sorting-paragraph)을 제공한다.
- **미리보기** `ctrl`(`cmd`)+`k` `ctrl`(`cmd`)+`p` - [미리보기](#미리보기-preview) 기능을 제공한다.

### 목차 표시 기능 (Table of Contents)

편집기 왼쪽 탐색기 탭에서 확인할 수 있으며, 문단 제목의 내용을 그대로 가져와 '개요'(outline) 란에 표시합니다.\
목차 클릭시 클릭한 목차로 이동됩니다.

![namucode_tableofcontent](./images/namucode_toc.png)
_▲ 나무위키:문법 도움말_

## 저작권 고지
이 프로젝트에 사용된 나무위키 아이콘 저작자는 kein, 저작권은 umanle S.R.L.가 소유하고 있으며, CC BY-NC-SA 2.0 KR 하에 배포됩니다. [(참고)](https://namu.wiki/w/%ED%8C%8C%EC%9D%BC:%EB%82%98%EB%AC%B4%EC%9C%84%ED%82%A4%20%EC%95%84%EC%9D%B4%EC%BD%98.svg)

이 프로젝트의 미리보기 기능의 구현을 위해 정현수님의 the tree 프로젝트의 코드를 사용했습니다.

## 기여
프로젝트 발전에 기여하시는 분들을 전부 환영합니다! [Pull Requests](https://github.com/jhk1090/namucode/pulls)를 통해 기여해주실 수 있습니다.

## 업데이트 로그

업데이트 로그는 [여기](https://github.com/jhk1090/namucode/blob/main/CHANGELOG.md)를 참고하세요.

## 참고

- [나무위키 문법 도움말](https://namu.wiki/w/나무위키:문법%20도움말)
- [Textmate Grammar](https://macromates.com/manual/en/language_grammars)
- [VSCode Extension Sample](https://github.com/microsoft/vscode-extension-samples)
