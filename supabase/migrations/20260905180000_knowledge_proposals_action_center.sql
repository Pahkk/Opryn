create table if not exists public.knowledge_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_type text not null default 'policy'
    check (proposal_type in ('policy', 'rule', 'faq', 'decision', 'exception')),
  title text not null check (char_length(title) between 1 and 200),
  proposed_content text not null check (char_length(proposed_content) between 1 and 20000),
  source_type text not null
    check (source_type in ('chatgpt', 'claude', 'external_ai', 'owner_answer', 'google_drive', 'call', 'document')),
  source_label text not null default 'Opryn learning source' check (char_length(source_label) between 1 and 300),
  source_id uuid,
  related_question_id uuid references public.employee_questions(id) on delete set null,
  related_process_id uuid references public.processes(id) on delete set null,
  process_rule_id uuid references public.process_rules(id) on delete set null,
  existing_knowledge_id uuid references public.knowledge_chunks(id) on delete set null,
  approved_knowledge_id uuid references public.knowledge_chunks(id) on delete set null,
  risk_level text not null default 'normal' check (risk_level in ('normal', 'critical')),
  review_reason text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'needs_review', 'approved', 'rejected', 'answer_only')),
  content_hash text not null check (char_length(content_hash) = 64),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter type public.process_status add value if not exists 'rejected';

create unique index if not exists knowledge_proposals_active_hash_idx
  on public.knowledge_proposals(organization_id, content_hash)
  where status in ('pending_approval', 'needs_review');
create unique index if not exists knowledge_proposals_process_rule_idx
  on public.knowledge_proposals(process_rule_id)
  where process_rule_id is not null;
create index if not exists knowledge_proposals_org_status_idx
  on public.knowledge_proposals(organization_id, status, risk_level desc, created_at desc);

drop trigger if exists knowledge_proposals_updated on public.knowledge_proposals;
create trigger knowledge_proposals_updated
  before update on public.knowledge_proposals
  for each row execute function public.set_updated_at();

alter table public.knowledge_proposals enable row level security;

create policy knowledge_proposals_admin_read on public.knowledge_proposals
  for select to authenticated using (public.is_org_admin(organization_id));
create policy knowledge_proposals_admin_insert on public.knowledge_proposals
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy knowledge_proposals_admin_update on public.knowledge_proposals
  for update to authenticated using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

grant select, insert, update on public.knowledge_proposals to authenticated;

alter table public.mcp_activity drop constraint if exists mcp_activity_tool_name_check;
alter table public.mcp_activity add constraint mcp_activity_tool_name_check check (
  tool_name in (
    'ask_opryn', 'search_company_knowledge', 'check_company_policy',
    'get_company_process', 'request_owner_guidance', 'learn_from_context',
    'create_process_from_context', 'approve_process',
    'deny_process', 'approve_knowledge_proposal', 'deny_knowledge_proposal',
    'answer_only_knowledge_proposal'
  )
);

alter table public.mcp_activity drop constraint if exists mcp_activity_result_status_check;
alter table public.mcp_activity add constraint mcp_activity_result_status_check check (
  result_status in (
    'answered', 'unknown', 'submitted', 'not_found', 'learning_started',
    'learned', 'needs_review', 'review_required', 'approved', 'rejected',
    'answer_only', 'already_resolved', 'premium_required', 'forbidden',
    'error', 'rate_limited'
  )
);

alter table public.knowledge_events drop constraint if exists knowledge_events_event_type_check;
alter table public.knowledge_events add constraint knowledge_events_event_type_check check (event_type in (
  'question_asked', 'question_answered', 'question_unknown', 'question_clustered',
  'question_escalated', 'expert_answered', 'owner_answered', 'knowledge_suggested',
  'knowledge_approved', 'knowledge_rejected', 'knowledge_confirmed',
  'knowledge_updated', 'knowledge_conflict_detected', 'answer_feedback_positive',
  'answer_feedback_negative', 'agent_query', 'agent_unknown',
  'proposal_created', 'proposal_approved', 'proposal_rejected',
  'proposal_answer_only', 'needs_you_resolved', 'approved_from_chatgpt',
  'approved_from_claude', 'approved_from_web', 'approved_from_external_ai'
));

comment on table public.knowledge_proposals is
  'One organization-scoped approval record shared by Opryn Web, MCP clients, notifications, Knowledge, and Needs You.';
comment on column public.knowledge_proposals.status is
  'pending_approval may be accepted inline; needs_review must be opened in Opryn before approval.';

update public.notifications
set link = '/app/needs-you?item=question-' || entity_id::text,
    target_url = '/app/needs-you?item=question-' || entity_id::text
where entity_type = 'question' and entity_id is not null;

create or replace function public.notify_owners_of_question()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare target_url text;
begin
  if new.status = 'needs_owner' and new.escalated = true
    and (tg_op = 'INSERT' or coalesce(old.escalated, false) = false) then
    target_url := '/app/needs-you?item=question-' || new.id::text;
    if new.assigned_expert_id is not null then
      insert into public.notifications (
        organization_id, user_id, type, title, body, link,
        entity_type, entity_id, action, target_url
      ) values (
        new.organization_id, new.assigned_expert_id, 'expert_answer_needed',
        'Opryn matched a question to you', new.question, target_url,
        'question', new.id, 'answer', target_url
      );
    else
      insert into public.notifications (
        organization_id, user_id, type, title, body, link,
        entity_type, entity_id, action, target_url
      )
      select
        new.organization_id, member.user_id, 'employee_question',
        'A teammate needs your answer', new.question, target_url,
        'question', new.id, 'answer', target_url
      from public.organization_members member
      where member.organization_id = new.organization_id
        and member.permission_level in ('owner', 'admin');
    end if;
  end if;
  return new;
end;
$$;
