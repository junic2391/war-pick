create type risk_event_type as enum ('missile', 'drone', 'bombing', 'naval', 'sanction');
create type risk_level as enum ('low', 'medium', 'high', 'critical');
create type verification_status as enum ('pending', 'verified', 'rejected');
create type asset_direction as enum ('up', 'down', 'mixed');

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_url text not null,
  external_id text,
  title text not null,
  summary_ko text,
  summary_en text,
  event_type risk_event_type not null,
  risk_level risk_level not null default 'medium',
  verification_status verification_status not null default 'pending',
  country_code text,
  region_name text,
  latitude double precision not null,
  longitude double precision not null,
  occurred_at timestamptz not null,
  detected_at timestamptz not null default now(),
  ai_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists risk_events_external_id_key
  on public.risk_events (source, external_id)
  where external_id is not null;

create index if not exists risk_events_occurred_at_idx
  on public.risk_events (occurred_at desc);

create index if not exists risk_events_risk_level_idx
  on public.risk_events (risk_level);

create index if not exists risk_events_region_idx
  on public.risk_events (country_code, region_name);

create table if not exists public.asset_impacts (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid not null references public.risk_events(id) on delete cascade,
  asset_code text not null,
  asset_name text not null,
  direction asset_direction not null default 'mixed',
  confidence numeric(4, 3) not null default 0.5,
  move_hint text,
  rationale text,
  created_at timestamptz not null default now()
);

create index if not exists asset_impacts_risk_event_id_idx
  on public.asset_impacts (risk_event_id);

create table if not exists public.infrastructure_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null,
  country_code text,
  latitude double precision not null,
  longitude double precision not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists infrastructure_assets_type_idx
  on public.infrastructure_assets (asset_type);

alter table public.risk_events enable row level security;
alter table public.asset_impacts enable row level security;
alter table public.infrastructure_assets enable row level security;

create policy "public read risk_events"
  on public.risk_events
  for select
  to anon, authenticated
  using (true);

create policy "public read asset_impacts"
  on public.asset_impacts
  for select
  to anon, authenticated
  using (true);

create policy "public read infrastructure_assets"
  on public.infrastructure_assets
  for select
  to anon, authenticated
  using (true);

