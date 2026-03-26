# RSC Prefetch 흐름 탐색 (Next.js 오픈소스)

> 탐색 목적: Link 태그에서 prefetch 요청 시 RSC 헤더가 추가되는 흐름 + 서버에서 RSC/HTML 분기하는 흐름 파악

---

## 최종 전체 흐름

### 클라이언트 → 서버 요청

```
<Link> hover/visibility
  ↓ webpack alias → client/app-dir/link.tsx
  ↓
client/components/links.ts
  onLinkVisibilityChanged() → rescheduleLinkPrefetch()
  ↓
client/components/segment-cache/prefetch.ts
  schedulePrefetchTask()
  ↓
client/components/segment-cache/scheduler.ts
  processQueueInMicrotask() → pingRoute() → spawnPrefetchSubtask()
  ↓
client/components/segment-cache/cache.ts  ★ RSC 헤더 세팅
  fetchRouteOnCacheMiss():
    headers = {
      [RSC_HEADER]: '1',
      [NEXT_ROUTER_PREFETCH_HEADER]: '1',
      [NEXT_ROUTER_SEGMENT_PREFETCH_HEADER]: segmentPath,
    }
  ↓
client/components/router-reducer/fetch-server-response.ts
  createFetch() → fetch() 실행
```

### 서버: RSC 헤더 감지 → 렌더 분기

```
server/base-server.ts
  handleRSCRequest()  ← URL 패턴 or 헤더로 4가지 분기
    ① segmentPrefetchRSC URL → 헤더 직접 주입 + meta 세팅
    ② .rsc URL             → 헤더 세팅 + meta 세팅
    ③ Vercel revalidation  → 헤더 제거, false 반환
    ④ RSC_HEADER === '1'   → meta만 세팅 (일반 fetch 케이스)
  addRequestMeta(req, 'isRSCRequest', true)  ← 내부 전달용
  ↓
server/app-render/app-render.tsx
  parseRequestHeaders(): isRSCRequest = headers[RSC_HEADER] !== undefined
  ↓
  L2188: if (isRSCRequest)
    → generateDynamicFlightRenderResult()  ← RSC Flight payload 반환
  else
    → HTML 렌더링 경로
```

### 클라이언트: 응답 수신 → SPA or MPA 분기

```
fetch-server-response.ts
  content-type 확인:
    application/x-component → isFlightResponse = true
    그 외 (text/html 등)    → doMpaNavigation() → URL string 반환
  ↓
  isFlightResponse = true:
    createFromReadableStream()  ← React Flight 프로토콜 디코더
    → flightData (NavigationFlightResponse)
    → normalizeFlightData() → flightData 객체 반환
  ↓
ppr-navigations.ts
  typeof result === 'string'  → exitStatus: HardRetry → MPA 네비게이션
  result.flightData 있음      → convertServerPatchToFullTree()
  ↓
  spawnDynamicRequests()  ← 동적 데이터 fetch 발사 (await 안 함)
  finishNavigationTask()  ← 완료 후 exitStatus 확인
    Done      → 정상 종료 (Promise resolve로 Suspense 해제)
    SoftRetry → dispatchRetryDueToTreeMismatch() (재요청)
    HardRetry → MPA 네비게이션
  ↓
use-action-queue.ts
  actionQueue.dispatch(action, setState)
  React.useState setState() 호출 → React 리렌더 트리거
  ↓
app-router.tsx
  pushRef.mpaNavigation === true:
    window.location.assign(url)  ← 브라우저 하드 네비게이션
    use(neverResolvedPromise)    ← React를 의도적으로 suspend (리렌더 방지)
  pushRef.mpaNavigation === false:
    → 변경된 segment만 교체 (Suspense resolve로 React가 알아서 리렌더)
```

---

## 핵심 개념

### addRequestMeta vs 헤더
- **헤더**: 클라이언트↔서버 외부 통신
- **requestMeta**: 서버 내부 미들웨어→렌더러 전달용 (req 객체에 붙는 사이드채널)

### FlightRenderResult vs RenderResult
- `FlightRenderResult`: `content-type: application/x-component`, RSC payload
- `RenderResult`: `content-type: text/html`, 풀 HTML

### PPR에서 Suspense가 상태 업데이트를 대체
- `spawnDynamicRequests`는 트리를 **in-place 수정**하고 Promise를 resolve
- dispatch 없이도 Suspense boundary가 해제되면서 React가 리렌더
- "Promise resolve = Suspense fallback 제거 = 실제 컨텐츠 표시"

### Tree Mismatch
- prefetch 시점에 예측한 라우터 트리 ≠ 실제 서버 응답 트리
- SoftRetry → 재요청 / HardRetry → MPA fallback

### MPA 네비게이션 구현 방식 (app-router.tsx)
```tsx
// 렌더 함수 안에서 side effect — React 팀도 "Don't try this at home"이라고 주석
if (pushRef.mpaNavigation) {
  window.location.assign(canonicalUrl)
  use(neverResolvedPromise)  // React를 영원히 suspend → 자식 리렌더 방지
}
```

---

## 확신을 준 주석들

탐색 중 "내가 맞게 찾았다"는 확신을 준 주석들. 주석이 없었다면 코드만으로 추측에 머물렀을 것들.

### SPA/MPA 하이브리드 분기 확인
`fetch-server-response.ts` L201
```
// If fetch returns something different than flight response handle it like a mpa navigation
// If the fetch was not 200, we also handle it like a mpa navigation
```
→ content-type 분기가 MPA/SPA 전환의 핵심임을 확인

`ppr-navigations.ts` L1523
```
// fetchServerResponse will return an href to indicate that the SPA
// navigation failed. For example, if the server triggered a hard
// redirect, or the fetch request errored. Initiate an MPA navigation
// to the given href.
```
→ string 반환 = MPA fallback 이라는 추측을 확인
-> MPA, SPA 용어를 함께 사용한다는 것에서 하이브리드 내비게이션 방식을 사용한다는 점에 확신이 생김

### app-router.tsx의 side effect 패턴
`app-router.tsx` L268-277
```
// When mpaNavigation flag is set do a hard navigation to the new url.
// Infinitely suspend because we don't actually want to rerender any child
// components with the new URL and any entangled state updates shouldn't
// commit either (eg: useTransition isPending should stay true until the page
// unloads).
//
// This is a side effect in render. Don't try this at home, kids.
```
→ 렌더 함수 안에서 window.location을 바꾸는 이상한 코드의 의도를 설명
→ `use(neverResolvedPromise)`로 React를 의도적으로 멈추는 이유도 여기서 납득
-> 이건 이해못함

### PPR에서 dispatch 없이 리렌더되는 이유
`ppr-navigations.ts` L1203-1216
```
// This does _not_ create a new tree; it modifies the existing one in place.
// Which means it must follow the Suspense rules of cache safety.
```
→ dispatch가 없는데 어떻게 React가 업데이트되는지 의문 해소
→ Promise resolve → Suspense 해제 → 리렌더 흐름이 맞음을 확인

`ppr-navigations.ts` L1237-1245
```
// This is intentionally not an async function to discourage the caller from
// awaiting the result. Any subsequent async operations spawned by this
// function should result in a separate navigation task, rather than
// block the original one.
```
→ await 없이 발사하는 게 버그가 아니라 의도된 설계임을 확인

### React 상태 관리 구조
`use-action-queue.ts` L58-63
```
// The useState hook in this module only exists to synchronize state that
// lives outside of React.
// Ideally, what we'd do instead is pass the state as a prop to root.render;
// this is conceptually how we're modeling the app router state, despite the
// weird implementation details.
```
→ App Router 상태가 React 바깥에 있고 useState는 브릿지라는 구조를 확인

### Tree Mismatch 조건
`ppr-navigations.ts` L1338-1343
```
// Once the all the requests have finished, check the tree for any remaining
// pending tasks. If anything is still pending, it means the server response
// does not match the client, and we must refresh to get back to a consistent
// state.
```
→ mismatch의 정확한 조건: 요청 완료 후에도 pending task가 남아있는 것

---

## 오픈소스 코드 탐색 팁

### 검색 전략

1. **Observable에서 시작**: DevTools에서 `Content-Type: application/x-component` 확인 → 그 문자열을 grep
2. **목적지 타입명 먼저 파악**: `FlightRenderResult`, `RenderResult` 등 결과물 타입을 알면 grep으로 생성 위치 바로 찾음
3. **grep 패턴 정밀하게**:
   - 프로퍼티 접근: `.mpaNavigation`
   - 함수 호출: `navigate(`
   - 할당/생성: `dispatch =`
4. **caller 추적보다 property 추적이 빠를 때가 많음**: caller는 팬아웃이 커서 미로가 됨. 특징적인 프로퍼티명으로 생성→소비 위치를 바로 연결

### 파일/코드 읽는 순서

5. **파일명 + 함수명 + 반환타입** 먼저 봐: 코드 안 읽어도 역할 추론 가능
   - `fetch-server-response.ts` → 서버 응답 fetch 담당
   - `doMpaNavigation(): string` → 이름+반환타입으로 동작 명확
6. **주석이 확신을 줌**: 코드로 추측한 내용을 주석이 확인해줌. 주석 없으면 불안해도, 주석이 "When mpaNavigation flag is set do a hard navigation"이라고 써있으면 맞게 찾은 거
7. **abstract class 만나면 서브클래스 찾기**: `base-server.ts`처럼 `abstract` 키워드 있으면 실제 구현은 다른 파일에 있음

### 멈출 타이밍

8. **React 내부 원리는 코드로 안 찾아도 됨**: `Promise resolve → Suspense 해제 → 리렌더`는 React 동작이지 Next.js 코드가 아님. 프레임워크 경계에서 멈추기
9. **목적이 "이해"라면 흐름의 윤곽이 보이면 충분**: 모든 라인을 이해할 필요 없음

### App Router 특이사항

10. **webpack alias 주의**: IDE go-to-definition이 실제 파일과 다를 수 있음 → `create-compiler-aliases.ts` 확인
11. **App Router vs Pages Router 구분**: `RouterContext` = Pages Router, `AppRouterContext` = App Router
