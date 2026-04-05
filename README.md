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
│   ├── functions/
│   └── migrations/
├── .env.example
└── package.json
```

## 실행 명령

```bash
npm run dev:mobile
npm run typecheck:mobile
```

## Live Feed 확인 순서

1. `.env.example`을 기준으로 `.env`를 만들고 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 채웁니다.
2. `supabase/migrations/202604040001_initial_schema.sql`을 적용합니다.
3. `supabase/seed.sql`을 실행해 `risk_events`, `asset_impacts` 검증용 데이터를 넣습니다.
4. `npm run dev:mobile`로 앱을 실행합니다.
5. 홈 화면 diagnostics가 mock fallback에서 live Supabase source로 전환되는지 확인합니다.
6. 특정 이벤트를 눌렀을 때 연결된 `asset_impacts`가 함께 보이는지 확인합니다.

## 환경 변수

```bash
cp .env.example .env
```

- `EXPO_PUBLIC_SUPABASE_URL`: Expo 앱과 Edge Function이 읽는 Supabase 대상 URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Expo 클라이언트 읽기 전용 anon key
- `SUPABASE_SERVICE_ROLE_KEY`: `ingest-rss`가 `risk_events`, `asset_impacts`를 upsert할 때 사용하는 키
- `RSS_SOURCE_URLS`: 스케줄러 입력용 RSS URL 목록

## 다음 빌드 단계

1. MapLibre 기반 실제 지도 캔버스 연결
2. RSS ingest 함수에 AI 추출 및 source verification 로직 추가
3. 선택 이벤트와 asset impact 패널 분리
4. 알림, deep link, event-focused landing flow 연결
