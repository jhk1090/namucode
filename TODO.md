# TODOs

## Progress

- FIXME: 추가한 단축키와 스니펫 모두 README.md로 업데이트
- 파일, 문서 링크와 리다이렉트, 유튜브 문법의 링크 URL 연결
  - TODO: 현재 링크 초안만 구현된 상태.
  - 중첩 링크 지원
- 제한적인 linting 구현
  - 문단/리스트 상하 관계가 이상한 경우 경고
- 단축키 폭넓게 추가

- 미리보기
  - 만약 workspace가 열리지 않았을 때 미리보기를 누르면 오류가 발생함 (수정 필요)
  - 메모리 누수 해결 플랜 -> thread를 1로 줄인다
  - 메모리 누수 해결 플랜 -> isolated-vm을 eval로 바꾼다

## Soon

- TODO: 접기 구현
- View docs: 문법 도움말 페이지로 연결
- Snippet 더 추가 (표, 기타 매크로, wiki-style 단축어 등)
- 표, 파일 매개변수 자동 완성
- 다양한 Code Actions 지원
- key.tmlanguage.json의 name을 모두 TextMate Grammar 컨벤션에 맞게 수정
- TeX 및 syntax문 언어에 맞는 색상 강조 적용 지원

## Undecided

- VSCode 내 inline 미리보기 지원
- 폭넓은 option 지원
- 색상 입력 시 색상 피커 지원, 헥스코드 도감 내장
- math, syntax, html 문법 내에서 타 언어 문법 강조
