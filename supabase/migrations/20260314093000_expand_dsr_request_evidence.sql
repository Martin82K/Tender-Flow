alter table public.data_subject_requests
  add column if not exists requester_label text not null default '',
  add column if not exists intake_channel text not null default 'email',
  add column if not exists verification_status text not null default 'pending',
  add column if not exists resolution_summary text not null default '';

alter table public.data_subject_requests
  drop constraint if exists data_subject_requests_intake_channel_check;

alter table public.data_subject_requests
  add constraint data_subject_requests_intake_channel_check
  check (intake_channel in ('email', 'form', 'phone', 'support', 'internal'));

alter table public.data_subject_requests
  drop constraint if exists data_subject_requests_verification_status_check;

alter table public.data_subject_requests
  add constraint data_subject_requests_verification_status_check
  check (verification_status in ('pending', 'verified', 'not_required'));

comment on column public.data_subject_requests.requester_label is
  'Jmeno nebo identifikace osoby, ktera DSR pozadavek podala.';
comment on column public.data_subject_requests.intake_channel is
  'Kanal, kterym byl DSR pozadavek prijat.';
comment on column public.data_subject_requests.verification_status is
  'Stav overeni identity zadatele pro DSR pozadavek.';
comment on column public.data_subject_requests.resolution_summary is
  'Strucne provozni shrnuti, jak byl DSR pozadavek vyrizen.';
