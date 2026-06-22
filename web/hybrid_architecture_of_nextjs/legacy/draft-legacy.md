# Next.js는 MPA인가 SPA인가 — 직접 뜯어봤다

## TL;DR

[시퀀스 다이어그램]

```
[직접 URL 진입]                          [Link 클릭 / prefetch]
rsc 헤더 없음                             rsc: 1 헤더 포함
        ↓                                         ↓
             서버 (app-render.tsx)
             isRSCRequest?
  NO → HTML (text/html)                YES → RSC payload (text/x-component)
        ↓                                         ↓
  전체 DOM 교체                           변경된 segment만 교체
  SEO 크롤러도 여기                       layout 재사용 → 깜빡임 없음
```

---

## 의문의 시작

SSG를 사용하다 보면 이상한 점이 있습니다. SSG는 빌드 타임에 HTML을 미리 생성해서 서빙만 합니다. 그렇다면 페이지 이동 시 새로운 HTML을 받아야 하니 전체 페이지가 다시 로드되면서 깜빡여야 하는데, 실제로 써보면 SPA처럼 매끄럽게 전환됩니다.

SEO 측면에서도 의문이 생깁니다. Next.js가 SSR로 SEO를 챙긴다고 하는데, 클라이언트 사이드 내비게이션을 쓰면 HTML을 새로 받지 않으니 검색 크롤러가 뭘 읽는 건지 명확하지 않습니다.

두 가지가 동시에 가능하다면, 진입 방식에 따라 다르게 처리하는 게 아닐까요? 공식 문서에 명확한 설명이 없어서 직접 확인해보기로 했습니다.

---

## 실험: 개발자도구

### 데모 앱 구성

[데모 앱 스펙 이미지]

간단한 Next.js 앱을 만들었습니다.

- `/` 홈 페이지 (공유 레이아웃)
- `/ssg` 페이지 (`export const dynamic = 'force-static'`)
- `/ssr` 페이지 (`export const dynamic = 'force-dynamic'`)
- 홈에 `<Link href="/ssg">`, `<a href="/ssg">` 두 개 배치
- 레이아웃에 마운트 시각을 표시하는 클라이언트 컴포넌트 배치 (재마운트 여부 확인용)

### Elements 탭: DOM 변화 비교

처음엔 깜빡임(플리커링)을 눈으로 직접 확인하려 했습니다. 그런데 최신 브라우저는 뷰 트랜지션 최적화가 잘 돼있어서 눈으로는 차이를 잡기 어려웠습니다. 대신 개발자도구 Elements 탭에서 DOM 변화를 관찰했습니다.

[gif - 직접 진입 / a 태그 이동 시 Elements 탭]

[gif - Link 태그로 이동 시 Elements 탭]

- **직접 진입 / `<a>` 이동:** 전체 DOM이 사라지고 새로 생성됩니다
- **`<Link>` 이동:** 레이아웃 DOM은 그대로, page 영역 하위 일부만 교체됩니다

진입 방식에 따라 DOM 변경 범위가 다르다는 것을 확인할 수 있었습니다.

### Network 탭: 응답 타입 비교

[직접 접근 시 네트워크 탭]

직접 URL 진입과 `<a>` 이동은 `text/html` 응답을 받습니다.

[Link prefetch 요청 네트워크 탭]

`<Link>`는 클릭 시점에 요청이 가는 줄 알았습니다. 그런데 아무것도 클릭하지 않았는데 페이지 로드 직후 `/ssg?_rsc=...` 요청이 이미 발생해 있었습니다. Link가 뷰포트에 보이는 순간 자동으로 prefetch를 시작한 것입니다. 응답의 `content-type`은 `text/x-component`입니다.

### 요청 헤더: 분기 조건

두 요청의 헤더를 비교했습니다.

**직접 진입:**
```
GET /ssg HTTP/1.1
Accept: text/html,application/xhtml+xml,...
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
```

**Link prefetch:**
```
GET /ssg?_rsc=... HTTP/1.1
Accept: */*
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
rsc: 1
next-router-prefetch: 1
```

`rsc: 1` 헤더가 핵심입니다. 서버는 URL이나 경로가 아니라 이 헤더 유무 하나로 어떤 형태의 응답을 보낼지 결정합니다.

> **덤으로 발견한 것:** SSG 페이지에서 Link로 이동하면 빌드 타임에 이미 HTML을 만들어뒀으니 RSC payload가 아닌 HTML이 올 거라 생각했습니다. 그런데 `.next/server/app/` 빌드 산출물을 보니 `ssg.html`과 `ssg.rsc` 두 파일이 모두 생성돼 있었습니다. SSG는 두 가지 진입 방식을 모두 대비해 두 파일을 빌드 타임에 미리 구워두는 것이었습니다.

---

## 오픈소스 탐색

실험으로 *무엇*이 다른지는 확인했습니다. 그렇다면 *어떻게* 구현되어 있는지 `vercel/next.js` 소스를 직접 뜯어봤습니다.

### 클라이언트: rsc 헤더는 어디서 붙나

Link 컴포넌트에서 시작하는 호출 체인을 따라갔습니다.

```
client/app-dir/link.tsx
  onLinkVisibilityChanged() → rescheduleLinkPrefetch()
  ↓
client/components/segment-cache/prefetch.ts
  schedulePrefetchTask()
  ↓
client/components/segment-cache/cache.ts  ← 여기서 헤더 세팅
  fetchRouteOnCacheMiss():
    headers = {
      [RSC_HEADER]: '1',
      [NEXT_ROUTER_PREFETCH_HEADER]: '1',
      ...
    }
  ↓
client/components/router-reducer/fetch-server-response.ts
  createFetch() → fetch() 실행
```

`rsc: 1` 헤더는 fetch 직전인 `fetchRouteOnCacheMiss()`에서 조립됩니다.

탐색 중 한 가지 함정이 있었습니다. IDE의 "정의로 이동"이 `client/link.tsx`를 가리켰는데, App Router에서는 빌드 타임에 webpack이 `client/app-dir/link.tsx`로 바꿔치기합니다. IDE는 이를 모르기 때문에 처음엔 Pages Router 코드를 한참 읽었습니다.

### 서버: 어디서 HTML vs RSC payload를 결정하나

```
server/base-server.ts
  handleRSCRequest()
    RSC_HEADER === '1' → addRequestMeta(req, 'isRSCRequest', true)
    ↓
server/app-render/app-render.tsx
  parseRequestHeaders(): isRSCRequest = headers[RSC_HEADER] !== undefined
    ↓
  if (isRSCRequest)
    → generateDynamicFlightRenderResult()  // RSC payload 반환
  else
    → HTML 렌더링 경로
```

`base-server.ts`가 헤더를 내부 메타데이터로 변환하고, `app-render.tsx`의 단 하나의 if/else가 응답 형태를 결정합니다.

### 클라이언트: 응답 받은 후 SPA vs MPA

서버가 결정하면 클라이언트는 그냥 받아쓸 줄 알았습니다. 그런데 클라이언트도 독립적인 분기 로직이 있었습니다.

```
fetch-server-response.ts
  content-type = application/x-component → isFlightResponse = true
  content-type = text/html (또는 에러)   → doMpaNavigation() → URL string 반환
```

RSC payload가 오면 React reconciliation으로 변경된 segment만 교체하고, HTML이나 에러가 오면 `window.location.assign`으로 MPA 하드 내비게이션을 합니다.

소스코드에서 직접 MPA/SPA 용어를 함께 쓰는 주석을 발견했을 때 확신이 생겼습니다.

`fetch-server-response.ts`:
```
// If fetch returns something different than flight response handle it like a mpa navigation
// If the fetch was not 200, we also handle it like a mpa navigation
```

`ppr-navigations.ts`:
```
// fetchServerResponse will return an href to indicate that the SPA
// navigation failed. For example, if the server triggered a hard
// redirect, or the fetch request errored. Initiate an MPA navigation
// to the given href.
```

코드로 추측한 내용을 주석이 확인해줬습니다.

---

## 마무리

Next.js는 MPA도 SPA도 아닙니다. 요청 헤더의 `rsc: 1` 유무를 분기점으로, 서버와 클라이언트가 각자 렌더링 방식을 결정하는 하이브리드입니다.

| 진입 방식 | 요청 헤더 | 응답 | 처리 |
|---|---|---|---|
| 직접 URL 진입 | rsc 헤더 없음 | `text/html` | 전체 DOM 교체 |
| Link 내비게이션 | `rsc: 1` | `text/x-component` | 변경 segment만 교체 |
| 에러 / 리다이렉트 | — | `text/html` | MPA fallback |

- SEO는 직접 진입 시 완성된 HTML을 받으므로 크롤러가 읽을 수 있습니다.
- UX는 Link 내비게이션으로 레이아웃을 재사용하고 데이터만 교체하니 깜빡임이 없습니다.
- 둘 다 포기하지 않는 게 마법이 아니라, 진입 방식에 따라 응답 형태를 바꾸는 엔지니어링입니다.

---

초대규모 코드베이스를 탐색하는 건 처음엔 방향을 잡기 어려워 길을 잃기도 했습니다. 그런데 하다 보니 지도 없이 탐험하는 것 같아서 재미있었습니다. IDE 함정도 있었고, 엉뚱한 코드를 한참 읽다가 돌아오기도 했습니다. 덕분에 다음엔 좀 더 빠르게 감을 잡을 수 있을 것 같다는 기대도 생겼습니다.
