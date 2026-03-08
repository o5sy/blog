# CSR vs SSR Demo

## 실행 방법

터미널 3개를 열어 각각 실행합니다.

```bash
# 1. Mock API 서버 (port 4000)
cd api && npm run dev

# 2. CSR (port 5173)
cd csr && npm run dev

# 3. SSR (port 3000)
cd ssr && npm run dev
```

## API delay 조절

- CSR: `csr/.env` → `VITE_API_DELAY=2000`
- SSR: `ssr/.env.local` → `API_DELAY=2000`

값을 바꾼 뒤 서버를 재시작하면 적용됩니다.

## 측정 시나리오

| 시나리오 | delay |
|---|---|
| 빠른 API | 0ms |
| 느린 API | 2000ms |
