alter table public.breach_cases
  add column if not exists affected_data_categories text[] not null default '{}'::text[],
  add column if not exists affected_subject_types text[] not null default '{}'::text[],
  add column if not exists estimated_subject_count integer null,
  add column if not exists notification_rationale text not null default '';

comment on column public.breach_cases.affected_data_categories is
  'Evidence kategorii osobnich udaju dotcenych breach pripadem.';
comment on column public.breach_cases.affected_subject_types is
  'Evidence typu subjektu udaju dotcenych breach pripadem.';
comment on column public.breach_cases.estimated_subject_count is
  'Priblizny odhad poctu dotcenych subjektu udaju pro breach pripad.';
comment on column public.breach_cases.notification_rationale is
  'Strucne oduvodneni, proc byl incident hlasen nebo nehlasen uradu a subjektum.';

update public.breach_cases
set
  affected_data_categories = coalesce(affected_data_categories, '{}'::text[]),
  affected_subject_types = coalesce(affected_subject_types, '{}'::text[]),
  notification_rationale = coalesce(notification_rationale, '')
where
  affected_data_categories is null
  or affected_subject_types is null
  or notification_rationale is null;
