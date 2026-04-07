update public.risk_events
set external_id = source_url
where external_id is null;

drop index if exists public.risk_events_external_id_key;

alter table public.risk_events
  alter column external_id set not null;

alter table public.risk_events
  add constraint risk_events_source_external_id_key unique (source, external_id);
