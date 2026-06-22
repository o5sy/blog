# 글 뼈대 — Next.js의 하이브리드 렌더링

---

## [도입]
- SSG는 미리 HTML 구워서 서빙만 하는데 왜 깜빡임이 없지?
- CSR의 SEO 문제를 SSR/SSG로 해결한다는데, 클라이언트 사이드 내비게이션 쓰면 HTML을 안 받는데 SEO가 어떻게 되는 거지?
- 진입 방식에 따라 다르게 처리하는 거 아닐까 — 직접 확인해보기로

---

## [실험: 개발자도구]
- Elements 탭: 깜빡임 눈으로 잡으려 했는데 최신 브라우저 뷰 트랜지션이 가려버림 → Elements 탭에서 DOM 변화로 대신 확인. 직접 진입·`<a>` = 전체 DOM 교체, Link = 일부만 교체
- Network 탭: 직접 진입 = `text/html`, Link = 클릭 시 요청 없음(이미 prefetch됨) → `text/x-component`
- 요청 헤더 비교: `rsc: 1` 유무가 분기 조건
- *(한 줄 언급)* SSG는 `.rsc` 파일도 빌드 타임에 미리 생성해둠 — 그래서 prefetch 시 서버 계산 없이 파일 서빙

---

## [오픈소스 탐색]
- 클라이언트: Link 가시성 감지 → prefetch 스케줄링 → `fetchRouteOnCacheMiss()`에서 `rsc: 1` 헤더 조립 → fetch 실행
- 서버: `base-server.ts`에서 헤더를 내부 메타로 변환 → `app-render.tsx` 단 하나의 if/else로 HTML vs RSC payload 결정
- 클라이언트 응답 처리: `content-type` 보고 독립적으로 SPA/MPA 판단 — RSC payload면 reconciliation, HTML이면 `window.location.assign` MPA fallback

---

## [마무리]
- Next.js는 MPA도 SPA도 아니다. `rsc: 1` 헤더를 분기점으로, 서버와 클라이언트가 각자 렌더링 방식을 결정하는 하이브리드
- SEO는 직접 진입 시 HTML로, UX는 Link 내비게이션 시 부분 교체로 — 둘 다 포기 안 함
- 초대규모 코드베이스에서 길 잃었던 얘기, 탐험하는 재미, 노하우 생긴 것