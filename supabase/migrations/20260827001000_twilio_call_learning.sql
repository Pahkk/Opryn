create table public.phone_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'twilio' check (provider in ('twilio')),
  account_identifier text not null,
  encrypted_credentials text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected', 'error')),
  created_by uuid not null references public.profiles(id),
  last_webhook_at timestamptz,
  last_successful_import_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider),
  unique (provider, account_identifier)
);

create table public.twilio_number_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.phone_integrations(id) on delete cascade,
  phone_number text not null,
  friendly_name text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  assigned_label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, phone_number)
);

create table public.call_learning_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  integration_id uuid references public.phone_integrations(id) on delete cascade,
  analyze_sales boolean not null default true,
  analyze_support boolean not null default true,
  analyze_incoming boolean not null default true,
  analyze_outgoing boolean not null default true,
  analyze_voicemail boolean not null default false,
  minimum_duration_seconds integer not null default 120 check (minimum_duration_seconds between 0 and 14400),
  automatic_processing boolean not null default true,
  retention_days integer not null default 7 check (retention_days in (0, 7, 30, 90)),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.call_recordings alter column uploaded_by drop not null;
alter table public.call_recordings alter column storage_path drop not null;
alter table public.call_recordings alter column original_name drop not null;
alter table public.call_recordings alter column size_bytes drop not null;
alter table public.call_recordings drop constraint if exists call_recordings_status_check;
alter table public.call_recordings add constraint call_recordings_status_check
  check (status in ('received', 'downloading', 'downloaded', 'uploaded', 'extracting_audio', 'transcribing', 'transcribed', 'analyzing', 'needs_review', 'approved', 'skipped', 'absent', 'failed'));
alter table public.call_recordings add column if not exists provider text not null default 'upload' check (provider in ('upload', 'twilio'));
alter table public.call_recordings add column if not exists integration_id uuid references public.phone_integrations(id) on delete set null;
alter table public.call_recordings add column if not exists provider_call_id text;
alter table public.call_recordings add column if not exists provider_recording_id text;
alter table public.call_recordings add column if not exists external_recording_url text;
alter table public.call_recordings add column if not exists direction text;
alter table public.call_recordings add column if not exists from_number text;
alter table public.call_recordings add column if not exists to_number text;
alter table public.call_recordings add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null;
alter table public.call_recordings add column if not exists duration_seconds integer;
alter table public.call_recordings add column if not exists channels integer;
alter table public.call_recordings add column if not exists recording_track text;
alter table public.call_recordings add column if not exists speaker_data jsonb not null default '{}'::jsonb;
alter table public.call_recordings add column if not exists analysis_summary text;
alter table public.call_recordings add column if not exists retention_until timestamptz;
alter table public.call_recordings add column if not exists processing_attempts integer not null default 0;
alter table public.call_recordings add column if not exists next_retry_at timestamptz;
alter table public.call_recordings add column if not exists processing_started_at timestamptz;

create unique index call_recordings_provider_recording_uidx
  on public.call_recordings(provider, provider_recording_id)
  where provider_recording_id is not null;
create index call_recordings_retry_idx
  on public.call_recordings(status, next_retry_at)
  where status in ('received', 'failed');
create index twilio_mappings_org_idx on public.twilio_number_mappings(organization_id);

create trigger phone_integrations_updated before update on public.phone_integrations
  for each row execute function public.set_updated_at();
create trigger twilio_number_mappings_updated before update on public.twilio_number_mappings
  for each row execute function public.set_updated_at();
create trigger call_learning_settings_updated before update on public.call_learning_settings
  for each row execute function public.set_updated_at();

alter table public.phone_integrations enable row level security;
alter table public.twilio_number_mappings enable row level security;
alter table public.call_learning_settings enable row level security;

create policy phone_integrations_service_only on public.phone_integrations
  for all to service_role using (true) with check (true);
create policy twilio_number_mappings_admin_read on public.twilio_number_mappings
  for select to authenticated using (public.is_org_admin(organization_id));
create policy twilio_number_mappings_service_all on public.twilio_number_mappings
  for all to service_role using (true) with check (true);
create policy call_learning_settings_admin_read on public.call_learning_settings
  for select to authenticated using (public.is_org_admin(organization_id));
create policy call_learning_settings_service_all on public.call_learning_settings
  for all to service_role using (true) with check (true);

grant select on public.twilio_number_mappings, public.call_learning_settings to authenticated;

comment on table public.phone_integrations is 'Service-role-only encrypted provider credentials. Auth tokens are never readable by browser clients.';
comment on column public.call_recordings.provider_recording_id is 'External idempotency identifier; RecordingSid for Twilio.';
comment on column public.call_recordings.external_recording_url is 'Server-only provider source URL. Never return this field to browser clients.';
