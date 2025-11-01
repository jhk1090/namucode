## 나무코드에 기여하기
🎉 먼저, 프로젝트 기여에 관심을 가져주셔서 감사합니다! 🎉

- [Pull Request](#pull-request)
- [코드 구조](#코드-구조)

### Pull Request
[Pull Requests](https://github.com/jhk1090/namucode/pulls)에 리퀘스트를 보내주세요!

- [작업 환경 구축하기](#작업-환경-구축하기)
	- [1. 이 저장소 포크하기](#1-이-저장소-포크하기)
	- [2. 포크한 저장소 클론하기](#2-포크한-저장소-클론하기)
	- [3. 빌드 전 사전 준비](#3-빌드-전-사전-준비)
- [프로젝트 빌드](#프로젝트-빌드)
	- [4. 빌드하기](#4-빌드하기)
	- [5. 빌드된 확장 실행하기](#5-빌드된-확장-실행하기)
- [Pull Request 보내기](#pull-request-보내기)
	- [6. 포크 저장소에 push하기](#6-포크-저장소에-push하기)
	- [7. 변경 사항 Pull Request 보내기](#7-변경-사항-pull-request-보내기)
#### 작업 환경 구축하기 
##### 1. 이 저장소 포크하기
상단의 Fork 버튼을 눌러 이 저장소를 포크합니다.
완료됐다면, `https://github.com/<id>/namucode`가 이 저장소를 포크한 기여자분의 저장소입니다!

##### 2. 포크한 저장소 클론하기
이제 포크한 저장소를 로컬로 옮겨 아래의 명령어를 실행합니다.
```sh
git clone https://github.com/<id>/namucode.git
```
축하합니다. `namucode` 폴더가 생성되었습니다!

##### 3. 빌드 전 사전 준비
먼저, 아래의 환경이 구축되어 있는지 확인하세요!

- Node.js 20 이상
- yarn 사용 환경
- vscode 1.75.0 이상

#### 프로젝트 빌드
##### 4. 빌드하기
최상위 폴더인 `namucode`에서 아래 코드를 실행해 프로젝트를 빌드합니다.
```sh
yarn build
```

만약, watch 모드로 들어가고 싶다면 아래 코드를 실행하세요.
```sh
yarn watch
```

##### 5. 빌드된 확장 실행하기
빌드가 성공적으로 끝났다면, `F5`를 누르거나, `나무코드 실행`을 눌러 확장 기능을 실험해 볼 수 있습니다.

#### Pull Request 보내기
##### 6. 포크 저장소에 push하기
```sh
git push -u origin main
```

##### 7. 변경 사항 Pull Request 보내기
포크 저장소에서 변경 사항 대조로 Pull Request를 보낼 수 있습니다.

### 코드 구조
- `client/media/parser` - 나무코드의 미리보기 기능 중 파싱을 위한 코드입니다.
- `client/media/frontend` - 프론트엔드를 담당하는 Vue.js 코드로, 미리보기 파싱 후 렌더링 시 활용됩니다.
- `client/src` - Linting 외 타 기능의 집합입니다.
- `server/src` - Linting을 담당합니다.