alter table public.risk_events
  add column if not exists event_sub_type text,
  add column if not exists event_direction text not null default 'escalation',
  add column if not exists confidence_score numeric(4, 3) not null default 0.6,
  add column if not exists market_sentiment text not null default 'neutral',
  add column if not exists time_horizon text not null default 'intraday',
  add column if not exists conflict_status text not null default 'active_conflict',
  add column if not exists story_key text not null default 'story_unknown',
  add column if not exists story_sequence integer not null default 1,
  add column if not exists source_count integer not null default 1,
  add column if not exists thesis text,
  add column if not exists scenario_base text,
  add column if not exists scenario_bull text,
  add column if not exists scenario_bear text,
  add column if not exists actors_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists targets_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists affected_assets_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists macro_channels_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists facts_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists numeric_facts_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists inferences_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists contradictions_json jsonb not null default '{"items":[]}'::jsonb,
  add column if not exists web_enriched boolean not null default false,
  add column if not exists web_enrichment_status text not null default 'not_needed';

alter table public.risk_events
  drop constraint if exists risk_events_event_direction_check;

alter table public.risk_events
  add constraint risk_events_event_direction_check
  check (event_direction in ('escalation', 'deescalation', 'resolution'));

alter table public.risk_events
  drop constraint if exists risk_events_market_sentiment_check;

alter table public.risk_events
  add constraint risk_events_market_sentiment_check
  check (market_sentiment in ('risk_on', 'risk_off', 'mixed', 'neutral'));

alter table public.risk_events
  drop constraint if exists risk_events_time_horizon_check;

alter table public.risk_events
  add constraint risk_events_time_horizon_check
  check (time_horizon in ('intraday', 'days', 'weeks', 'months'));

alter table public.risk_events
  drop constraint if exists risk_events_conflict_status_check;

alter table public.risk_events
  add constraint risk_events_conflict_status_check
  check (conflict_status in ('active_conflict', 'ceasefire', 'negotiation', 'sanctions_cycle', 'resolved'));

alter table public.risk_events
  drop constraint if exists risk_events_web_enrichment_status_check;

alter table public.risk_events
  add constraint risk_events_web_enrichment_status_check
  check (web_enrichment_status in ('not_needed', 'pending', 'completed', 'skipped_unconfigured', 'failed'));

create index if not exists risk_events_story_key_idx
  on public.risk_events (story_key, occurred_at desc);

create index if not exists risk_events_market_sentiment_idx
  on public.risk_events (market_sentiment, occurred_at desc);
