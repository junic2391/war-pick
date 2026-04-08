alter table public.risk_events
  add column if not exists importance_score smallint not null default 5;

alter table public.risk_events
  drop constraint if exists risk_events_importance_score_check;

alter table public.risk_events
  add constraint risk_events_importance_score_check
  check (importance_score >= 0 and importance_score <= 10);

create index if not exists risk_events_importance_score_idx
  on public.risk_events (importance_score desc, occurred_at desc);
