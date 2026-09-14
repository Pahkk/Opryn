alter table public.notifications
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists action text,
  add column if not exists target_url text;

create index if not exists notifications_entity_idx
  on public.notifications(organization_id, entity_type, entity_id, created_at desc);

alter table public.organization_settings
  add column if not exists ai_process_creation text not null default 'auto_draft'
    check (ai_process_creation in ('always_ask', 'auto_draft')),
  add column if not exists ai_process_approval_prompt text not null default 'ask_immediately'
    check (ai_process_approval_prompt in ('ask_immediately', 'add_to_needs_approval'));

alter table public.processes
  add column if not exists criticality text not null default 'normal'
    check (criticality in ('normal', 'critical')),
  add column if not exists assigned_expert_id uuid references public.profiles(id) on delete set null,
  add column if not exists edited_before_approval boolean not null default false;

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
      'learn_from_context',
      'create_process_from_context',
      'approve_process'
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
      'needs_review',
      'review_required',
      'approved',
      'premium_required',
      'forbidden',
      'error',
      'rate_limited'
    )
  );

comment on column public.notifications.target_url is
  'Canonical organization-scoped in-product destination for the notification action.';
comment on column public.organization_settings.ai_process_creation is
  'Whether connected AI asks before creating a process or creates a Needs Review draft automatically.';

create or replace function public.notify_owners_of_question()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare target_url text;
begin
  if new.status = 'needs_owner' and new.escalated = true
    and (tg_op = 'INSERT' or coalesce(old.escalated, false) = false) then
    target_url := '/app?question=' || new.id::text || '#needs-you';
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
