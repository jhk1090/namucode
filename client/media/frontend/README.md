# the tree frontend
[the tree](https:////github.com/wjdgustn/thetree) 엔진을 위한 프론트엔드입니다.

## 기여
프로젝트 상태, 기능의 일관성, 저작권 문제 등으로 인해 이 프로젝트에 대한 공개 기여는 받지 않을 생각입니다.

다만 스킨은 아래 [스킨 제작 가이드](#스킨-제작-가이드)를 참고해 자유롭게 제작하실 수 있습니다.

## 라이선스
[the tree](https:////github.com/wjdgustn/thetree)와 동일한 라이선스를 적용합니다.

## 스킨 적용 가이드
1. npm i 명령어를 통해 라이브러리를 다운로드합니다.
   ```shell
    npm i
   ```
1. skins 폴더(src 안 아님)에 원하는 스킨을 clone합니다. git을 사용하지 않으면 빌드할 수 없습니다.
   <br>아래는 추천하는 스킨 목록입니다.
   - [liberty](https://github.com/wjdgustn/thetree-skin-liberty)
   - [buma](https://github.com/wjdgustn/thetree-skin-buma)
1. .env.local 파일을 생성하고 아래 내용을 작성합니다.
   ```dotenv
   SKIN_NAME=스킨 이름
   ```
1. 빌드 명령어를 통해 빌드합니다.
   ```shell
   npm run build
   ```
1. dist 폴더를 the tree 엔진의 skins 폴더에 복사합니다.
1. dist 폴더의 이름을 스킨 이름으로 변경합니다.
1. the tree 엔진을 재시작합니다.

## 스킨 제작 가이드
1. npm i 명령어를 통해 라이브러리를 다운로드합니다.
   ```shell
    npm i
   ```
1. skins 폴더(src 안 아님)에 스킨 폴더를 생성합니다.
1. .env.local 파일을 생성하고 아래 내용을 작성합니다.
    ```dotenv
    SKIN_NAME=스킨 이름
    API_HOST=https://testwiki.hyonsu.com # 타 위키엔 작동하지 않습니다. 로컬에서 the tree를 구동중인 경우 이 줄은 삭제합니다.
    ```
1. 테스트 명령어로 프론트엔드를 구동합니다.
    ```shell
    npm test
    ```