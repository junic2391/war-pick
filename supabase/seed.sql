-- Sample live feed rows for local or hosted Supabase verification.
-- Run this after the initial schema migration to populate WAR-PICK's mobile feed.

insert into public.risk_events (
  id,
  source,
  source_url,
  external_id,
  title,
  summary_ko,
  summary_en,
  event_type,
  risk_level,
  verification_status,
  country_code,
  region_name,
  latitude,
  longitude,
  occurred_at,
  detected_at,
  ai_payload
)
values
  (
    '4f6fd8d1-f1f5-42c0-830a-badc1f717111',
    'WAR-PICK Seed',
    'https://example.com/live/hormuz-alert',
    'seed-hormuz-alert',
    '호르무즈 해협 인근 긴장 고조',
    '해협 인근 군사 충돌 가능성이 높아지며 원유와 안전자산이 빠르게 반응하고 있습니다.',
    'Tension near the Strait of Hormuz is lifting oil and safe-haven sensitivity.',
    'missile',
    'high',
    'verified',
    'IR',
    'Strait of Hormuz',
    26.566,
    56.249,
    now() - interval '8 minutes',
    now() - interval '6 minutes',
    jsonb_build_object(
      'seed', true,
      'theme', 'energy chokepoint',
      'confidence', 0.82
    )
  ),
  (
    '4f6fd8d1-f1f5-42c0-830a-badc1f717112',
    'WAR-PICK Seed',
    'https://example.com/live/red-sea-drone',
    'seed-red-sea-drone',
    '홍해 항로 드론 위협 감지',
    '홍해 항로 경계 수위가 다시 올라가며 해운과 공급망 민감도가 확대되고 있습니다.',
    'Drone-related threat signals in the Red Sea are lifting shipping and supply-chain sensitivity.',
    'drone',
    'medium',
    'pending',
    'YE',
    'Red Sea',
    15.103,
    42.571,
    now() - interval '21 minutes',
    now() - interval '18 minutes',
    jsonb_build_object(
      'seed', true,
      'theme', 'shipping lane',
      'confidence', 0.73
    )
  ),
  (
    '4f6fd8d1-f1f5-42c0-830a-badc1f717113',
    'WAR-PICK Seed',
    'https://example.com/live/eastern-europe-strike',
    'seed-eastern-europe-strike',
    '동유럽 인프라 타격 발생',
    '에너지 및 물류 인프라 타격 보고가 이어지며 유럽 자산 민감도가 높아지고 있습니다.',
    'Strikes on infrastructure in Eastern Europe are raising energy and logistics sensitivity.',
    'bombing',
    'medium',
    'verified',
    'UA',
    'Eastern Europe',
    48.379,
    31.165,
    now() - interval '43 minutes',
    now() - interval '39 minutes',
    jsonb_build_object(
      'seed', true,
      'theme', 'infrastructure',
      'confidence', 0.84
    )
  )
on conflict (id) do update
set
  source = excluded.source,
  source_url = excluded.source_url,
  external_id = excluded.external_id,
  title = excluded.title,
  summary_ko = excluded.summary_ko,
  summary_en = excluded.summary_en,
  event_type = excluded.event_type,
  risk_level = excluded.risk_level,
  verification_status = excluded.verification_status,
  country_code = excluded.country_code,
  region_name = excluded.region_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  occurred_at = excluded.occurred_at,
  detected_at = excluded.detected_at,
  ai_payload = excluded.ai_payload,
  updated_at = now();

insert into public.asset_impacts (
  id,
  risk_event_id,
  asset_code,
  asset_name,
  direction,
  confidence,
  move_hint,
  rationale
)
values
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7101',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717111',
    'WTI',
    'Oil',
    'up',
    0.82,
    '+2.4%',
    '호르무즈 해협 긴장은 원유 운송 병목 우려를 키워 유가 상방 압력을 강화할 수 있습니다.'
  ),
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7102',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717111',
    'XAU',
    'Gold',
    'up',
    0.75,
    '+1.1%',
    '중동 지정학 리스크 확대 시 안전자산 선호가 강해지며 금이 동반 강세를 보일 수 있습니다.'
  ),
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7103',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717112',
    'BDI',
    'Freight',
    'up',
    0.73,
    '+1.8%',
    '홍해 항로 긴장 재확대는 운임과 선복 불확실성을 끌어올릴 수 있습니다.'
  ),
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7104',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717112',
    'SOX',
    'Semis',
    'down',
    0.68,
    '-0.6%',
    '항로 지연이 커지면 반도체 공급망 심리가 위축될 수 있습니다.'
  ),
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7105',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717113',
    'TTF',
    'Gas',
    'up',
    0.84,
    '+3.2%',
    '동유럽 인프라 타격은 유럽 에너지 수급 불안을 자극해 가스 가격에 상방 압력을 줄 수 있습니다.'
  ),
  (
    '8f1f7d76-8702-4f30-af0f-78dca6aa7106',
    '4f6fd8d1-f1f5-42c0-830a-badc1f717113',
    'DEFENSE',
    'Defense',
    'up',
    0.72,
    '+1.5%',
    '방산 관련 수급 기대가 단기적으로 강해질 수 있습니다.'
  )
on conflict (id) do update
set
  risk_event_id = excluded.risk_event_id,
  asset_code = excluded.asset_code,
  asset_name = excluded.asset_name,
  direction = excluded.direction,
  confidence = excluded.confidence,
  move_hint = excluded.move_hint,
  rationale = excluded.rationale;
