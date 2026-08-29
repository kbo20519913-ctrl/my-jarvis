# 시황실

세계·한국 경제, 주식, 펀드, 코인 현황을 웹 검색과 Claude로 정리하는 공개 웹앱입니다. 미래 시세를 보장하지 않으며 투자 자문이 아닙니다.

## 스택

- React, TypeScript, Vite, Tailwind CSS, Lucide
- Supabase Auth / Postgres / Storage
- Netlify Functions + Anthropic Claude (`claude-sonnet-5`)
- GitHub → Netlify CI/CD

## 로컬 실행

1. `.env.example`을 `.env`로 복사하고 값을 넣습니다.
2. 스키마는 가능하면 Cursor(Supabase MCP / CLI)로 `supabase/migrations/20260829000000_init.sql`을 적용합니다. 대시보드 SQL Editor는 크롬 번역과 충돌할 수 있습니다.
3. Auth에서 이메일 가입을 켭니다.
4. 본인 유저의 `raw_app_meta_data`에 `"role": "admin"`을 넣습니다.
5. `npm install` 후 `npm run dev`

### Supabase 대시보드 `removeChild` 오류

크롬 번역(또는 번역 확장)이 대시보드 DOM을 바꾸면 React가 `removeChild`에서 죽습니다. supabase.com은 번역하지 않음으로 두고, 번역 제안을 끈 뒤 시크릿 창에서 다시 여세요. SQL은 대시보드 대신 마이그레이션 파일로 적용하세요.

프론트 변수:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Functions 전용 (절대 `VITE_`로 넣지 않음):

- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`, `GOOGLE_CSE_ID` (Programmable Search, 전체 웹)
- `YOUTUBE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (시간별 알림)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Functions에서 JWT 검증, 없으면 VITE_ 값을 재사용)

## Netlify

1. GitHub 저장소를 연결합니다.
2. Build: `npm run build`, Publish: `dist`
3. 위 환경 변수를 Production / Deploy preview에 넣습니다. `VITE_*`는 빌드 타임에 들어갑니다.
4. `.gitignore`에 `.env`, `.netlify`가 포함되어 있습니다. 키를 커밋하지 마세요.

## 한국 주식 티커

- 삼성전자: `005930` (Yahoo `005930.KS`)
- 코인: `KRW-BTC` (Upbit)
