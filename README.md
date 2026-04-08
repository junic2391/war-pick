# WAR-PICK

WAR-PICK은 투자자를 위한 모바일 중심 지정학 리스크 레이더입니다. 분쟁 신호를 실시간 지도, 짧은 AI 브리핑, 자산 연동 알림으로 바꿔서 사용자가 긴 뉴스 피드를 모두 읽지 않아도 시장 민감 이벤트를 빠르게 파악할 수 있도록 설계합니다.

## 현재 범위

- `apps/mobile`: 레이더 랜딩, 이벤트 피드, feed diagnostics UI를 포함한 Expo 모바일 앱
- `supabase/migrations`: conflict event, asset impact, infrastructure overlay를 위한 초기 스키마
- `supabase/functions/ingest-rss`: RSS 수집 결과를 정규화하고 저장하는 Edge Function 초안

## 기술 방향

- 모바일 앱: Expo, React Native, TypeScript
- 지도 및 시각화: MapLibre, React Native Skia
- 백엔드: Supabase Postgres, Realtime, Edge Functions
- 수집 파이프라인: RSS polling, Gemini 기반 이벤트 추출
- 로컬라이징: 한국어 우선, 영어 확장 가능 구조

## 프로젝트 구조

```text
war-pick/
├── apps/
│   └── mobile/
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── _shared/
│   │   └── ingest-rss/
│   ├── tests/
│   └── migrations/
├── .env.example
└── package.json
```

## 실행 명령

```bash
npm run dev:mobile
npm run typecheck:mobile
supabase start
supabase functions serve ingest-rss --no-verify-jwt
deno test supabase/tests/ingest-ai-test.ts supabase/tests/ingest-rss-test.ts supabase/tests/web-enrichment-test.ts
```

## 로컬 테스트 권장 흐름

1. 프로젝트 루트에서 `supabase start`를 실행합니다.
2. 별도 터미널에서 `supabase functions serve ingest-rss --no-verify-jwt`를 실행합니다.
3. `supabase/functions/.env`에 로컬 RSS source 목록을 채웁니다.
4. `apps/mobile/.env`를 로컬 기준으로 채웁니다.
4. Expo를 완전히 재시작합니다.
5. 앱에서 `RSS 수집` 버튼을 눌러 `risk_events`, `asset_impacts`가 갱신되는지 확인합니다.

예시:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<local anon or publishable key>
EXPO_PUBLIC_INGEST_RSS_URL=http://127.0.0.1:54321/functions/v1/ingest-rss
```

로컬 function secret 예시: `supabase/functions/.env`

```bash
RSS_SOURCE_URLS=https://feeds.bbci.co.uk/news/world/rss.xml,https://feeds.bbci.co.uk/news/world/middle_east/rss.xml
```

의도:
- `BBC World` -> 전세계 지정학 이벤트 감지
- `BBC Middle East` -> 중동 리스크 감지 강화

추가 후보:
- `UN Security Council updates` -> 제재/안보 상태 변화의 공식 검증 신호
- 다만 현재 로컬 fetch 기준 `403`이 확인돼 기본값에서는 제외했다

주의:
- iOS Simulator는 보통 `127.0.0.1`로 로컬 서버에 접근할 수 있습니다.
- Android Emulator는 보통 `10.0.2.2`를 써야 합니다.
- 실기기 테스트면 Mac의 LAN IP로 바꿔야 합니다. 예: `http://192.168.0.10:54321/functions/v1/ingest-rss`

## Live Feed 확인 순서

1. `apps/mobile/.env.example`을 기준으로 `apps/mobile/.env`를 만들고 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`를 채웁니다.
2. `supabase/migrations/202604040001_initial_schema.sql`을 적용합니다.
3. `supabase/migrations/20260406173500_enable_realtime_publication.sql`까지 적용해 `risk_events`, `asset_impacts`를 `supabase_realtime` publication에 추가합니다.
4. `supabase/seed.sql`을 실행해 `risk_events`, `asset_impacts` 검증용 데이터를 넣습니다.
5. `npm run dev:mobile`로 앱을 실행합니다.
6. 홈 화면 diagnostics가 mock fallback에서 live Supabase source로 전환되는지 확인합니다.
7. 특정 이벤트를 눌렀을 때 연결된 `asset_impacts`가 함께 보이는지 확인합니다.

## 환경 변수

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

모바일 앱 env:
- `EXPO_PUBLIC_SUPABASE_URL`: Expo 앱이 읽는 Supabase 대상 URL
- `EXPO_PUBLIC_SUPABASE_KEY`: Supabase Connect 다이얼로그 기준 Expo 클라이언트용 publishable key
- `EXPO_PUBLIC_INGEST_RSS_URL`: 로컬 테스트용 direct Edge Function URL. 이 값이 있으면 앱이 `supabase functions invoke` 대신 해당 URL로 직접 POST합니다.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: 원격 Supabase Edge Function invoke에 사용할 JWT 형식 anon key. 로컬 `--no-verify-jwt` 흐름에는 필수가 아닙니다.

서버/ingest env:
```bash
cp .env.example .env
```

- `SUPABASE_URL`: Edge Function 또는 서버 작업이 읽는 Supabase 대상 URL
- `SUPABASE_SECRET_KEY`: `ingest-rss`가 `risk_events`, `asset_impacts`를 upsert할 때 사용하는 서버 전용 secret key
- `GOOGLE_GENAI_API_KEY`: `ingest-rss`가 기사 전량을 AI classify 할 때 사용하는 API key
- `GOOGLE_GENAI_MODEL`: 기본값은 `gemini-2.5-flash-lite`, 필요 시 다른 Gemini 모델로 교체 가능
- `AI_PUBLISH_MIN_IMPORTANCE`: AI relevance를 통과한 기사 중 실제 DB에 publish할 최소 `importanceScore` (기본값 `4`)
- `TAVILY_API_KEY`: 고중요 기사에서 출처 충돌 또는 핵심 사실 부족 시 웹 검색 보강을 붙일 때 사용하는 선택값

로컬 Edge Function secret:
```bash
cp supabase/functions/.env.example supabase/functions/.env
```

- `RSS_SOURCE_URLS`: 로컬 `supabase functions serve`가 읽는 RSS source 목록
- 공식 로컬 규칙 기준으로 `supabase/functions/.env`가 자동 로드된다
- 루트 `.env`의 값은 `supabase functions serve`가 자동으로 읽지 않는다
- `GOOGLE_GENAI_API_KEY`, `GOOGLE_GENAI_MODEL`, `AI_PUBLISH_MIN_IMPORTANCE`도 로컬에선 `supabase/functions/.env` 또는 `--env-file`로 넣어야 한다

현재 코드에서는 zero-downtime 전환을 위해 legacy 값도 fallback으로 읽습니다.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` -> `EXPO_PUBLIC_SUPABASE_KEY`의 fallback
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` -> `EXPO_PUBLIC_SUPABASE_KEY`의 마지막 fallback
- `SUPABASE_SERVICE_ROLE_KEY` -> `SUPABASE_SECRET_KEY`의 fallback

주의:
- 로컬 `supabase functions serve ingest-rss --no-verify-jwt` 흐름에서는 `EXPO_PUBLIC_INGEST_RSS_URL`만 있으면 `RSS 수집` 버튼이 동작합니다.
- 현재 `ingest-rss` 기본 경로는 `valid article -> Gemini classify -> importance threshold publish -> persist`입니다.
- AI taxonomy는 `missile / drone / bombing / naval / sanction / diplomatic / cyber / nuclear / energy / political`까지 확장돼, 고조/완화/해소 방향을 함께 저장합니다.
- heuristic screening과 heuristic fallback은 실서비스 ingest 경로에서 제거했습니다.
- 비용 제어는 `curated RSS source`, `batch classify`, `summary truncation`, `flash-lite model`, `AI_PUBLISH_MIN_IMPORTANCE` 쪽에서 가져갑니다.
- `GOOGLE_GENAI_API_KEY`가 없거나 Gemini 호출이 실패하면 함수는 에러를 반환합니다. 조용한 fallback은 없습니다.
- `RSS 수집` 버튼은 요청에 manual article fallback을 같이 보내지만, 함수 쪽 `RSS_SOURCE_URLS`가 채워져 있으면 실제 RSS fetch를 우선 사용합니다.
- 실시간 feed 조회는 `EXPO_PUBLIC_SUPABASE_KEY`로 충분하지만, JWT 검증이 켜진 원격 Edge Function invoke는 별도 JWT가 필요합니다.
- 현재 모바일의 `RSS 수집` 버튼은 로컬 direct URL이 없을 때 `EXPO_PUBLIC_SUPABASE_ANON_KEY` 또는 `EXPO_PUBLIC_SUPABASE_FUNCTIONS_JWT`가 있어야 동작합니다.
- 배포된 `ingest-rss` 함수에서 JWT 검증을 끄지 않았다면 `sb_publishable_...` 키만으로는 `edge function returned a non-2xx status code`가 발생합니다.
- `TAVILY_API_KEY`가 있으면 `webSearchRecommended=true` 이벤트는 Tavily 뉴스 검색으로 추가 출처를 조회하고, `web_enrichment_status`가 `pending -> completed/failed`로 실제 갱신됩니다.

`apps/mobile/.env`를 바꾼 뒤에는 Expo 프로세스를 완전히 다시 시작해야 새 값이 반영됩니다.

## 다음 빌드 단계

1. MapLibre 기반 실제 지도 캔버스 연결
2. RSS ingest 함수에 AI 추출 및 source verification 로직 추가
3. 선택 이벤트와 asset impact 패널 분리
4. 알림, deep link, event-focused landing flow 연결
