# 탐구 계획 — Next.js의 렌더링 방식: MPA? SPA?

---

## ⚡ 세션 이어받기 (새 채팅용 컨텍스트)

**블로그 딥다이브 스킬** (`/blog-deep-dive`) 사용 중. **탐구 완료.**

### 완료된 것
- 실험 #1~#6 완료
- 클라이언트 소스코드 분석 완료 (발견 #7): prefetch → `rsc: 1` 헤더 추가 호출 체인 확인
- 서버 소스코드 분석 완료 (발견 #8): `RSC_HEADER` 감지 → HTML vs RSC payload 분기 지점 확인
- 클라이언트 응답 처리 분석 완료 (발견 #9): content-type 기반 SPA/MPA 분기 흐름 확인

### 다음 단계
**블로그 글 작성** — `/blog-deep-dive` 스킬 사용

### 이 파일 구조
- 상단: 탐구 배경 / 가설 / 방법
- 중간: 발견 기록 (#1~#9)
- 하단: 핵심 결론 (완성)

---

## 핵심 질문

Next.js에서 직접 URL 진입과 클라이언트 사이드 내비게이션은 서버로부터 어떤 데이터를 다르게 받는가?

---

## 탐구 배경

전통적인 MPA → 새로고침으로 인한 깜빡임 문제
→ CSR 방식의 SPA 등장 → SEO 취약
→ Next.js에서 SSG/SSR로 보완

**의문점:**
1. SSG/SSR은 서버에서 완성된 HTML을 보내주는데, 그게 MPA라면 어떻게 깜빡임이 없지?
2. 클라이언트 사이드 내비게이션으로 HTML을 새로 받는 게 아닌데, SEO가 어떻게 좋아지지?

**가설:** 진입 방식에 따라 주고받는 데이터가 달라진다.

---

## 오리지널 관찰 가설

> "직접 URL 진입 시엔 완성된 HTML을 받고, 클라이언트 사이드 내비게이션 시엔 HTML 없이
> JSON 형태의 페이지 데이터(RSC payload 또는 props)만 받는다.
> 그래서 SEO 크롤러는 직접 진입과 같은 방식으로 HTML을 받고,
> 사용자는 이후 내비게이션에서 깜빡임 없이 데이터만 교체한다."

**예상 핵심 인사이트:**
> Next.js는 MPA도 SPA도 아니라, 진입 방식에 따라 응답 형태 자체를 바꾸는 하이브리드다.

---

## 탐구 방법

### 1. 직접 실험

- **실험 조건:** SSG/SSR 페이지 2~3개짜리 Next.js 예제 앱, Chrome DevTools Network 탭
- **관찰 대상:**
  - 진입 방식별 응답 타입 (HTML vs JSON/RSC payload)
  - 응답 크기
  - 요청 URL 패턴

### 2. .next 폴더 구조 확인

`out/` 또는 `.next/server/` 아래 HTML 파일과 JSON 파일이 어떻게 나뉘는지

### 3. 소스코드 분석

- 레포: `vercel/next.js`
- 탐구 시작 지점: `packages/next/src/server/app-router.ts`
  → 라우터가 요청을 받아서 처리하는 분기 로직

---

## 탐구 순서

1. **예제 앱 세팅** — SSG 페이지 1개 + SSR 페이지 1개 + `<Link />` 내비게이션 포함
2. **직접 URL 진입 실험** — Network 탭에서 첫 응답이 HTML인지 확인, 응답 헤더/바디 기록
3. **클라이언트 사이드 내비게이션 실험** — 같은 페이지를 `<Link />`로 이동, 응답 타입 비교
4. **.next 폴더 확인** — build 후 어떤 파일이 생성되는지, HTML과 JSON/RSC payload 구조 확인
5. **소스코드 분석** — 실험에서 관찰한 응답 차이가 코드 어디서 분기되는지 추적

---

## 범위 제한

- RSC payload 포맷 내부 스펙은 분석 안 함
- App Router 중심으로 탐구, Pages Router는 도입부에서 "같은 원리, 다른 구현" 한 줄 언급만
- 캐싱 전략, fetch 동작은 건드리지 않음
- 소스코드는 "분기가 어디서 일어나는지" 한 지점만 찾으면 됨. 전체 흐름 추적 안 함

---

## 발견 기록

### [발견 #1] 직접 URL 진입 시 HTML 응답
- **관찰:** `http://localhost:3000/ssg` 직접 입력 → Network 탭
- **응답 헤더:**
  ```
  content-type: text/html; charset=utf-8
  Vary: rsc, next-router-state-tree, next-router-prefetch, ...
  x-nextjs-cache: HIT
  x-nextjs-prerender: 1
  ```
- **응답 바디:** 완성된 `<html>...</html>` 문서
- **한 줄 해석:** 직접 진입은 완성된 HTML 문서를 받는다 (MPA처럼)
- **가설과 달랐나:** N (예상 맞음)

---

### [발견 #2] 클라이언트 사이드 내비게이션 시 RSC payload 응답
- **관찰:** `<Link href="/ssg">` prefetch 요청 → `/ssg?_rsc=...` 요청
- **응답 헤더:**
  ```
  content-type: text/x-component
  Vary: rsc
  ```
- **응답 바디:** 알 수 없는 문자열 (RSC 포맷, 바이너리 유사)
- **한 줄 해석:** 클라이언트 사이드 내비게이션은 HTML 아닌 컴포넌트 데이터를 받는다
- **가설과 달랐나:** N (예상 맞음)

---

### [발견 #3] 요청 헤더의 `rsc` 필드가 분기 포인트
- **관찰:** 두 요청의 Request Headers 비교

  **직접 진입:**
  ```
  GET /ssg HTTP/1.1
  Accept: text/html,application/xhtml+xml,...
  Sec-Fetch-Dest: document
  Sec-Fetch-Mode: navigate
  (rsc 헤더 없음)
  ```

  **클라이언트 네비게이션:**
  ```
  GET /ssg?_rsc=... HTTP/1.1
  Accept: */*
  Sec-Fetch-Dest: empty
  Sec-Fetch-Mode: cors
  rsc: 1
  next-router-prefetch: 1
  ```

- **한 줄 해석:** 서버는 요청의 `rsc` 헤더 유무로 HTML vs RSC payload를 결정한다
- **가설과 달랐나:** Y
  - 예상: 응답 형태가 URL이나 다른 요소로 결정됨
  - 실제: 요청 헤더의 `rsc: 1` 필드가 핵심 분기 조건

---

### [발견 #4] Link 내비게이션은 layout 컴포넌트를 언마운트하지 않음 -> 제거
- **관찰:** MountTime 컴포넌트(클라이언트 컴포넌트, layout.tsx)의 시간 변화
  - `<Link>` 클릭: 배너 색/시간 유지
  - `<a>` 클릭: 배너 색/시간 초기화
- **렌더링 파이프라인:**
  - `<a>`: 전체 DOM 폐기 → 새 HTML 파싱 → 모든 컴포넌트 재마운트
  - `<Link>`: 기존 DOM 유지 → React reconciliation → page 영역만 교체
- **한 줄 해석:** 클라이언트 사이드 내비게이션은 layout을 재사용해서 깜빡임을 제거한다
- **가설과 달랐나:** N (예상 맞음)

---

### [발견 #5] Link는 페이지가 viewport에 나타나는 순간 prefetch
- **관찰:** 홈 페이지 로드 후, 아무것도 클릭 안 했는데 `/ssg?_rsc=...` 요청 발생
- **원인:** `<Link>` 컴포넌트의 자동 prefetch 동작
- **의미:** RSC payload 미리 받아두므로, 클릭 시점엔 이미 데이터 준비됨
- **한 줄 해석:** Link는 성능 최적화를 위해 자동으로 데이터를 미리 가져온다
- **가설과 달랐나:** Y
  - 예상: Link 클릭 시점에 요청 발생
  - 실제: Link가 보이는 순간부터 prefetch 시작

---

### [발견 #6] .next 빌드 산출물 구조 — SSG vs SSR -> 스킵하거나 ssg는 빌드시 payload도 생성해둔다는 것 아주 간략히 언급
- **관찰:** `npm run build` 후 `.next/server/app/` 아래 파일 비교

  **SSG (`force-static`):**
  ```
  ssg.html       ← 직접 URL 진입용 완성된 HTML (빌드 타임 생성)
  ssg.rsc        ← Link 내비게이션용 RSC payload (빌드 타임 생성)
  ssg.meta       ← 캐시/라우팅 메타데이터
  ssg/           ← 컴파일된 서버 컴포넌트 JS 모듈
  ssg.segments/  ← Suspense 경계 기준 스트리밍 세그먼트
  ```

  **SSR (`force-dynamic`):**
  ```
  ssr/           ← 컴파일된 서버 컴포넌트 JS 모듈만 존재
  (html, rsc 파일 없음)
  ```

- **한 줄 해석:** SSG는 HTML과 RSC payload를 빌드 타임에 둘 다 구워놓는다. SSR은 요청마다 코드를 실행해 그때그때 생성한다.
- **가설과 달랐나:** Y
  - 예상: SSG는 HTML만 미리 만들어 둘 것
  - 실제: RSC payload(`.rsc`)까지 미리 생성 → Link 클릭 시 서버 계산 없이 파일 그대로 서빙

---

### [발견 #7] 클라이언트 소스코드 — prefetch → rsc 헤더 추가 호출 체인

**[잘못된 경로 - Pages Router]**
```
client/link.tsx (L326, RouterContext)
→ client/router.ts
→ shared/lib/router/router.ts (prefetch, fetchNextData)
✗ Pages Router였음
```

**[올바른 경로 - App Router]**
```
client/app-dir/link.tsx
→ client/components/links.ts
    onLinkVisibilityChanged() → rescheduleLinkPrefetch()
→ segment-cache/prefetch.ts
    prefetch()  ← 진입점
→ segment-cache/scheduler.ts
    schedulePrefetchTask()
    processQueueInMicrotask() → pingRoute()
→ segment-cache/cache.ts
    fetchRouteOnCacheMiss()
    headers = { RSC_HEADER: '1', ... }  ← 헤더 세팅
    fetchPrefetchResponse(url, headers)
→ router-reducer/fetch-server-response.ts
    createFetch()  ← 실제 fetch 실행
```

- **한 줄 해석:** `rsc: 1` 헤더는 fetch 직전인 `fetchRouteOnCacheMiss()`에서 조립된다
- **함정:** IDE "정의로 이동"은 `client/link.tsx`를 가리키지만, App Router에서는 빌드 타임에 번들러가 `app-dir/link.tsx`로 바꿔치기함. IDE는 이를 모름

---

### [발견 #8] 서버 소스코드 — RSC 헤더를 읽고 분기하는 곳
- **탐색 경로:**
  ```
  server/base-server.ts
    handleRSCRequest()
      RSC_HEADER === '1' → addRequestMeta(req, 'isRSCRequest', true)
      ↓
  server/app-render/app-render.tsx
    parseRequestHeaders(): isRSCRequest = headers[RSC_HEADER] !== undefined
      ↓
    L2188: if (isRSCRequest)
      → generateDynamicFlightRenderResult()  // RSC payload 반환
    else
      → HTML 렌더링 경로
  ```
- **한 줄 해석:** 서버는 `RSC_HEADER`를 내부 메타(`isRSCRequest`)로 변환하고, `app-render.tsx`의 단일 if/else 분기에서 HTML vs RSC payload를 결정한다
- **추가 발견:** `addRequestMeta`는 서버 내부 미들웨어→렌더러 전달용 사이드채널. 헤더는 클라이언트↔서버 통신용, requestMeta는 서버 내부 통신용으로 역할이 다름
- **가설과 달랐나:** N (예상 맞음)

---

### [발견 #9] 클라이언트 — 응답 받은 후 SPA/MPA 분기
- **탐색 경로:**
  ```
  fetch-server-response.ts
    content-type = application/x-component → isFlightResponse = true
    content-type = text/html (또는 에러)   → doMpaNavigation() → URL string 반환
    ↓
  ppr-navigations.ts
    result가 string    → exitStatus: HardRetry → MPA 네비게이션
    result가 flightData → convertServerPatchToFullTree() → 변경 segment만 교체
    ↓
  app-router.tsx
    pushRef.mpaNavigation === true:
      window.location.assign(url)   // 브라우저 하드 네비게이션
      use(neverResolvedPromise)     // React를 의도적으로 suspend (리렌더 방지)
    pushRef.mpaNavigation === false:
      → 변경된 segment만 교체 (Suspense resolve → React 리렌더)
  ```
- **한 줄 해석:** 클라이언트도 content-type을 보고 SPA/MPA를 결정한다. RSC payload가 오면 React reconciliation, HTML이 오면 `window.location.assign`으로 MPA fallback
- **가설과 달랐나:** Y
  - 예상: 서버가 응답 형태를 결정하면 클라이언트는 그냥 받아씀
  - 실제: 클라이언트도 content-type 기반으로 SPA/MPA를 독립적으로 판단하는 분기가 있음

---

## 핵심 결론

Next.js는 **하이브리드 렌더링**을 구현한다:

| 진입 방식 | 요청 | 응답 | 렌더링 파이프라인 |
|---|---|---|---|
| 직접 URL | GET /page | HTML (text/html) | Parse → Compile → Execute → Render (전체) |
| Link 내비게이션 | GET /page?_rsc=1 + `rsc: 1` 헤더 | RSC payload (text/x-component) | React reconciliation (변경 부분만) |
| 에러 / 리다이렉트 | (위와 동일) | HTML or 에러 | MPA fallback (window.location.assign) |

**분기는 두 단계에서 일어난다:**
1. **서버:** `rsc: 1` 헤더 → `isRSCRequest` → HTML vs RSC payload 선택 (`app-render.tsx` L2188)
2. **클라이언트:** `content-type` → SPA reconciliation vs MPA fallback 선택 (`fetch-server-response.ts`)

- **SEO:** 검색 크롤러는 직접 진입 방식으로 HTML 받음 ✓
- **UX:** 사용자는 클라이언트 사이드 내비게이션으로 깜빡임 제거 ✓
- **안전망:** RSC 응답 실패 시 클라이언트가 MPA로 자동 전환 ✓
- **SSG 최적화:** `.html` + `.rsc` 두 파일을 빌드 타임에 미리 생성 → 요청마다 서버 계산 없음 ✓