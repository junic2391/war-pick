alter table public.risk_events
  add column if not exists title_ko text,
  add column if not exists title_en text,
  add column if not exists source_language text,
  add column if not exists briefing_localized_json jsonb not null default '{}'::jsonb;

update public.risk_events
set
  title_ko = coalesce(title_ko, title),
  title_en = coalesce(title_en, title),
  source_language = coalesce(source_language, 'other')
where title_ko is null
   or title_en is null
   or source_language is null;

alter table public.risk_events
  drop constraint if exists risk_events_source_language_check;

alter table public.risk_events
  add constraint risk_events_source_language_check
  check (source_language in ('ko', 'en', 'other'));

create index if not exists risk_events_source_language_idx
  on public.risk_events (source_language, occurred_at desc);
