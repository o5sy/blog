## 소개

React를 주 스택으로 사용하면서 Next.js를 처음 공부했을 때, SSR(Server-Side Rendering)을 적용해 SPA + CSR의 SEO 문제를 해결한다는 걸 알게 됐습니다.

그러다 한가지 의문이 생겼습니다.
"SSR이면 서버에서 HTML을 생성해서 보내줄텐데, 페이지를 이동할 때마다 새로운 HTML을 받게되면 깜빡이는 것처럼 보이지 않나? 이건 MPA의 구조적 문제인데? Next.js는 MPA인가?"

그런데 실제로 Next.js로 구축된 웹을 사용해보면 깜빡임 없이 부드럽게 전환됩니다.

어떻게 서버에서 HTML을 새로 받으면서 깜빡임이 없는 건지 직접 확인해보기로 했습니다.


## 탐구 1: 공식 문서 확인

처음에는 Next.js 공식 문서에서 관련 내용을 찾아보았습니다. <br/>
https://nextjs.org/docs/app/guides/single-page-applications

> Next.js fully supports building Single-Page Applications (SPAs). 

Next.js는 SPA를 완벽하게 제공한다고 합니다.

제게는 `support`가 보조의 느낌이라 'SPA로 동작합니다'보단 'SPA는 아니지만 SPA처럼 동작합니다'라고 느껴집니다. 🤔 <br>
좀 더 살펴보겠습니다.

> This includes **fast route transitions with prefetching**, client-side data fetching, using browser APIs, integrating with third-party client libraries, creating static routes, and more

여기에 **prefetching을 통한 빠른 경로 전환**에 대한 내용이 있습니다. prefetch가 부드러운 페이지 전환의 핵심일 것 같습니다.

> Next.js can automatically code split your JavaScript bundles, and **generate multiple HTML entry points into different routes**. This avoids loading unnecessary JavaScript code on the client-side, reducing the bundle size and enabling faster page loads.

> The **next/link component** automatically **prefetches routes**, giving you **the fast page transitions of a strict SPA**, but with the advantage of persisting application routing state to the URL for linking and sharing.

**여러 경로에 대한 HTML 진입점**을 생성할 수 있다는 내용도 있고, <br/>
**`<Link>`** 컴포넌트로 경로를 prefetch해서 [엄격한 SPA](https://nextjs.org/docs/app/guides/single-page-applications#what-is-a-single-page-application)처럼 빠른 페이지 전환을 제공한다고 합니다.

이로써 prefetch 하는 `<Link>` 컴포넌트가 핵심이란 걸 알 수 있습니다. <br>
또한 여러 진입점을 생성한다는 것도 SEO와 관련해 중요해보입니다. 페이지 전환이 빠른건 SEO와는 독립적인 내용이니까요.


## 탐구 2: 데모 앱 실험

공식 문서로 힌트는 얻었지만 아직 풀리지 않은 의문이 있습니다.

`<Link>`로 prefetch 한다면 HTML을 미리 받아두는 걸까요? 그럼 전환할 때 또 깜빡이지 않을까요?<br>
도대체 뭘 받아서 어떻게 하는 걸까요?

간단한 앱을 만들어서 어떻게 동작하는지 살펴보겠습니다.

### 데모 앱 구성

실험 조건을 만들기 위해 간단한 Next.js 앱을 구성했습니다.

- next.js v16.2.9
- SSG 페이지 1개 (/ssg)
- SSR 페이지 1개 (/ssr)
- 메인 페이지 1개
- 메인에서 각 경로로 이동할 수 있도록 내비게이션 추가 (`<Link>` 컴포넌트, `<a>` 태그 각각 1개씩)

![메인 페이지](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/01.png?raw=true)

### 개발자 도구 확인

먼저 `<Link>` 컴포넌트가 추가된 메인 페이지에 진입해 네트워크 탭을 확인했습니다.<br>
예상한대로 내비게이션이 추가된 페이지와 관련된 요청이 있었습니다.<br>
(참고로 production 환경으로 실행해야 정상적으로 prefetch 해오는걸 확인할 수 있습니다.)

![_rsc 파라미터 요청](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/02.png?raw=true)

요청 URL은 `/ssr?_rsc=...`과 같은 형태이고, Content-Type이 `text/x-component`인걸 봐서 html을 받아오는 건 아니라는 건 알 수 있었습니다. (rsc는 react server component를 의미하는 것 같습니다.)

두개의 내비게이션 방식으로 페이지 전환을 해보겠습니다.

Link 컴포넌트로 전환하면 메인 페이지에서 봤던 것과 동일한 요청이 있으며, <br>
헤더 탭을 살펴보면 응답 헤더에 `Content-Type: text/x-component`가 있고, 요청 헤더에 `rsc: 1`이라는 수상한 헤더가 있습니다.

![응답 헤더](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/03.png?raw=true)
![요청 헤더](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/04.png?raw=true)

반면 a 태그로 전환하면 URL을 입력해 직접 진입하는 것과 동일하게 `Content-Type: text/html`을 받아옵니다.

두번째로 elements 탭을 살펴봤습니다.

![elements 탭 비교](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/05.gif?raw=true)

Link 컴포넌트로 이동하면 DOM 일부가 변경하는 것이 보이고, a 태그로는 전체 페이지를 새로고침하는 것이 보입니다.

자세한 원리는 몰라도 Link 컴포넌트로 전환 시 x-component 형식을 받아오며, DOM 일부만 변경하는 방식으로 부드러운 전환이 일어난다는 것을 알 수 있습니다.

#### (추신) SSG는 어떨까?
/ssr을 중심으로 살펴봐도 충분했지만, SSG에 흥미로운 점이 있어 덧붙이려 합니다.

SSG는 빌드 타임에 HTML을 생성하는 방식입니다.
그래서 'Link 컴포넌트로 전환하더라도 /ssr과 달리 HTML을 응답하지 않을까?'라고 예상했습니다.

하지만 /ssg 경로로 전환 시 동일하게 `x-component`를 응답했습니다.

빌드 결과물을 확인해 보니 `ssg.html`과 `ssg.rsc` 두 파일이 생성되어 있었습니다.<br>
아마 클라이언트 사이드 전환을 지원하기 위해 `.rsc` 형태의 파일을 생성하는 것으로 보입니다.

![.rsc 파일](https://raw.githubusercontent.com/o5sy/blog/main/web/hybrid_architecture_of_nextjs/01-client-side-navigation/img/06.png?raw=true)

정적 페이지인 SSG조차 부드러운 페이지 전환을 지원한다는 점이 흥미롭습니다. Next.js는 페이지에 진입하거나 이동하는 방식에 따라 다른 전략을 사용하는 프레임워크라는 사실을 다시 한번 확인할 수 있었습니다.

## 결론
Next.js는 직접 진입 시에는 HTML을 응답하는 MPA와 유사하게 동작하지만,
Link 컴포넌트로 전환 시에는 x-component 형태의 응답을 받아 일부 DOM만 교체하며 SPA처럼 동작하는
하이브리드로 동작합니다.

즉, 진입 방식에 따라 다르게 동작하며 SEO와 UX 문제를 모두 해결한 프레임워크라고 볼 수 있겠습니다.

| 진입 방식 | 요청 헤더 | 응답 형태 | 처리 방식 |
|---|---|---|---|
| 직접 URL 진입 / a 태그| rsc 헤더 없음 | `text/html` | 전체 DOM 교체 |
| Link 내비게이션 | `rsc: 1` | `text/x-component` | 변경 segment만 교체 |

- SEO는 직접 진입 시 완성된 HTML을 받으므로 크롤러가 읽을 수 있습니다.
- UX는 Link 내비게이션으로 일부만 변경하므로 전체 페이지 깜빡임이 없습니다.

## 마무리
이번 탐구를 통해 공식 문서에 나온 `Next.js fully supports building SPAs`의 의미를 조금 더 이해할 수 있었습니다.

또한 SSR을 단순히 서버에서 HTML을 생성해 응답한다는 걸로만 이해하고 있었는데, 응답 형태보다는 **중요한 콘텐츠를 미리 포함**시켜 응답한다는 게 핵심이 아닐까 하고, 관점을 바꾸게 되었습니다.

다만 아직 _rsc 요청 파라미터나 `rsc: 1`과 같은 요청 헤더의 정체를 알지는 못했습니다.<br>
다음 글에서는 오픈소스를 따라가며 실제로 어떻게 동작하는지 좀 더 자세히 살펴보겠습니다. 🤓

혹시나 잘못된 부분이 있다면 댓글로 알려주세요!

<!-- 개인적 소감으로는 궁금한 것을 탐구하는 자체가 재미있었습니다.
이 내용이 당장 서비스 개발에 도움되진 않겠으나, 기술을 그냥 쓰는 것과 원리를 알고 쓰는 건 장기적으로 차이가 난다고 믿습니다.<br>
또한 SEO와 부드러운 전환은 양자택일의 문제라고 생각했는데, 이 둘을 동시에 해결하는 방식을 확인하면서 엔지니어링적 인사이트도 얻게 됐습니다. -->