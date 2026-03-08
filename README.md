# blog

개인 블로그 글 작업 저장소 입니다.
구성 및 초안, 데모 코드를 관리합니다.
현재 사용중인 플랫폼은 dev.to로, 깃허브 이미지 url을 리모트 주소로 사용합니다.

## dev.to 업로드 전처리

`draft.md`를 dev.to에 바로 올릴 수 있는 형태로 변환합니다.

- `<figure>` 태그 → 마크다운 이미지 문법
- 로컬 이미지(`./img/`) → GitHub raw URL
- SVG 외부 이미지 → PNG로 변환 후 GitHub raw URL
- 최상단 H1 제목 제거

### 사전 준비

```bash
brew install librsvg
```

### 사용법

글 디렉토리로 이동 후 실행합니다.

```bash
cd web/csr_vs_ssr/01_개념_정리
npm run devto
```

같은 디렉토리에 `devto.md`가 생성됩니다.

경로를 직접 지정하려면:

```bash
npm run devto -- path/to/draft.md
```

변환 후 새로 다운로드된 이미지가 있으면 push해야 URL이 유효해집니다.

```bash
git add web/ && git commit -m 'add: images' && git push
```