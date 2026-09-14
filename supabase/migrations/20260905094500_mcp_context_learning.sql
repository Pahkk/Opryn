alter table public.mcp_activity
  drop constraint if exists mcp_activity_tool_name_check;

alter table public.mcp_activity
  add constraint mcp_activity_tool_name_check check (
    tool_name in (
      'ask_opryn',
      'search_company_knowledge',
      'check_company_policy',
      'get_company_process',
      'request_owner_guidance',
      'learn_from_context'
    )
  );

alter table public.mcp_activity
  drop constraint if exists mcp_activity_result_status_check;

alter table public.mcp_activity
  add constraint mcp_activity_result_status_check check (
    result_status in (
      'answered',
      'unknown',
      'submitted',
      'not_found',
      'learning_started',
      'learned',
      'premium_required',
      'forbidden',
      'error',
      'rate_limited'
    )
  );

alter table public.processes
  add column if not exists source_provider text,
  add column if not exists source_title text;

alter table public.processes
  drop constraint if exists processes_source_provider_check;

alter table public.processes
  add constraint processes_source_provider_check check (
    source_provider is null or source_provider in ('chatgpt', 'claude', 'external_ai')
  );

alter table public.knowledge_chunks
  drop constraint if exists knowledge_chunks_source_type_check;

alter table public.knowledge_chunks
  add constraint knowledge_chunks_source_type_check check (source_type in (
    'process_summary', 'process_step', 'rule', 'exception', 'owner_answer',
    'role_instruction', 'call_finding', 'faq', 'google_drive', 'video_finding',
    'chatgpt', 'claude', 'external_ai'
  ));

alter table public.external_ai_knowledge_access
  drop constraint if exists external_ai_knowledge_access_source_type_check;

alter table public.external_ai_knowledge_access
  add constraint external_ai_knowledge_access_source_type_check check (source_type in (
    'process_summary', 'process_step', 'rule', 'exception', 'owner_answer',
    'role_instruction', 'call_finding', 'faq', 'google_drive', 'video_finding',
    'chatgpt', 'claude', 'external_ai'
  ));

create table public.external_learning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  grant_id uuid references public.mcp_oauth_grants(id) on delete set null,
  client_kind text not null check (client_kind in ('chatgpt', 'claude', 'custom_mcp')),
  name text not null check (char_length(name) between 1 and 200),
  learning_type text not null check (learning_type in ('business', 'process', 'topic')),
  context_text text,
  notes text,
  source_title text,
  content_hash text not null check (char_length(content_hash) = 64),
  status text not null default 'received' check (
    status in ('received', 'processing', 'extracting', 'organizing', 'needs_review', 'complete', 'failed')
  ),
  process_id uuid references public.processes(id) on delete set null,
  result_summary jsonb not null default '{"processes":0,"rules":0,"faqs":0,"clarifications":0}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, created_by, client_kind, content_hash)
);

create index external_learning_jobs_org_status_idx
  on public.external_learning_jobs(organization_id, status, created_at desc);
create index external_learning_jobs_grant_idx
  on public.external_learning_jobs(grant_id, created_at desc);

create trigger external_learning_jobs_updated
  before update on public.external_learning_jobs
  for each row execute function public.set_updated_at();

alter table public.external_learning_jobs enable row level security;

create policy external_learning_jobs_member_read
  on public.external_learning_jobs for select to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_org_admin(organization_id)
  );

grant select on public.external_learning_jobs to authenticated;
revoke insert, update, delete on public.external_learning_jobs from anon, authenticated;

alter table public.onboarding_events
  drop constraint if exists onboarding_events_event_type_check;

alter table public.onboarding_events
  add constraint onboarding_events_event_type_check check (event_type in (
    'organization_created','goal_selected','knowledge_location_selected',
    'integration_selected','integration_connected','first_knowledge_created',
    'first_knowledge_approved','first_test_question','team_invited',
    'onboarding_completed','step_skipped','learning_started',
    'learning_completed','knowledge_detected'
  ));

comment on table public.external_learning_jobs is
  'Explicit, organization-scoped learning requests sent from connected AI clients. Raw context is removed after successful extraction.';
comment on column public.processes.source_provider is
  'The intentional external AI source for a reviewed process, when applicable.';
