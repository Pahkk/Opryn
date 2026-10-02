-- Provider-neutral source selections for Nango-backed knowledge imports.
-- No provider credentials or provider user profiles are stored here.
create table public.integration_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  provider text not null check (provider in ('notion', 'confluence')),
  external_id text not null check (char_length(external_id) between 1 and 500),
  source_type text not null check (source_type in ('page', 'database', 'space')),
  title text not null check (char_length(title) between 1 and 500),
  parent_context text check (parent_context is null or char_length(parent_context) <= 500),
  external_url text check (external_url is null or char_length(external_url) <= 2000),
  provider_version text check (provider_version is null or char_length(provider_version) <= 300),
  modified_at timestamptz,
  process_id uuid references public.processes(id) on delete set null,
  content_hash text check (content_hash is null or char_length(content_hash) = 64),
  sync_status text not null default 'selected'
    check (sync_status in ('selected','imported','changed','unavailable','error')),
  metadata jsonb not null default '{}',
  selected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, external_id, source_type)
);

create index integration_sources_org_idx
  on public.integration_sources(organization_id, provider, sync_status, updated_at desc);
create index integration_sources_check_idx
  on public.integration_sources(last_checked_at nulls first)
  where sync_status in ('imported','changed');

create trigger integration_sources_updated before update on public.integration_sources
for each row execute function public.set_updated_at();

alter table public.integration_sources enable row level security;
revoke all on public.integration_sources from public, anon, authenticated;
grant all on public.integration_sources to service_role;

alter table public.processes drop constraint if exists processes_learning_source_check;
alter table public.processes add constraint processes_learning_source_check
  check (learning_source in (
    'text','voice','video','screen','google_drive','ai_conversation','notion','confluence'
  ));

alter table public.processes
  add column if not exists supersedes_process_id uuid references public.processes(id) on delete set null;
alter table public.processes drop constraint if exists processes_source_provider_check;
alter table public.processes add constraint processes_source_provider_check check (
  source_provider is null or source_provider in ('chatgpt','claude','external_ai','notion','confluence')
);

alter table public.knowledge_chunks drop constraint if exists knowledge_chunks_source_type_check;
alter table public.knowledge_chunks add constraint knowledge_chunks_source_type_check check (source_type in (
  'process_summary','process_step','rule','exception','owner_answer','role_instruction',
  'call_finding','faq','google_drive','video_finding','chatgpt','claude','external_ai',
  'notion','confluence'
));

alter table public.external_ai_knowledge_access drop constraint if exists external_ai_knowledge_access_source_type_check;
alter table public.external_ai_knowledge_access add constraint external_ai_knowledge_access_source_type_check check (source_type in (
  'process_summary','process_step','rule','exception','owner_answer','role_instruction',
  'call_finding','faq','google_drive','video_finding','chatgpt','claude','external_ai',
  'notion','confluence'
));

alter table public.communication_integrations
  add column if not exists nango_integration_id uuid references public.integrations(id) on delete set null;
create unique index communication_integrations_nango_idx
  on public.communication_integrations(nango_integration_id)
  where nango_integration_id is not null;

comment on table public.integration_sources is
  'Explicitly selected provider content. Metadata is identity-minimal and credentials remain in Nango.';
comment on column public.integration_sources.metadata is
  'Sanitized provider metadata. Atlassian and Notion user identity fields are forbidden by application validation.';
