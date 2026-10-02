-- Clarifications are child interactions on existing questions, not a second inbox.
create table public.question_clarifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question_id uuid not null references public.employee_questions(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  message text not null check(char_length(message) between 3 and 2000),
  reply text check(char_length(reply) between 3 and 4000),
  status text not null default 'open' check(status in ('open','answered','canceled')),
  created_at timestamptz not null default now(), answered_at timestamptz
);
create unique index one_open_question_clarification on public.question_clarifications(question_id) where status='open';
alter table public.question_clarifications enable row level security;
create policy question_clarification_read on public.question_clarifications for select to authenticated
  using (public.is_org_member(organization_id) and exists(select 1 from public.employee_questions q
    where q.id=question_id and q.organization_id=question_clarifications.organization_id
      and (q.asked_by=auth.uid() or q.assigned_expert_id=auth.uid() or public.is_org_admin(q.organization_id))));
grant select on public.question_clarifications to authenticated;
grant all on public.question_clarifications to service_role;

create function public.manage_gap_question(target_organization_id uuid,target_question_id uuid,
  question_action text,target_expert_id uuid default null,action_note text default '',target_clarification_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.employee_questions; actor uuid:=auth.uid(); admin boolean; clarification public.question_clarifications;
begin
  if actor is null or not public.is_org_member(target_organization_id) then raise exception 'Workspace access required' using errcode='42501'; end if;
  select * into q from public.employee_questions where id=target_question_id and organization_id=target_organization_id for update;
  if not found then raise exception 'Question not found' using errcode='P0002'; end if;
  admin:=public.is_org_admin(target_organization_id);
  if question_action='reply' then
    if q.asked_by is distinct from actor then raise exception 'Only the asker can supply this context' using errcode='42501'; end if;
    select * into clarification from public.question_clarifications where id=target_clarification_id
      and question_id=q.id and organization_id=target_organization_id and status='open' for update;
    if not found or q.status <> 'needs_owner' then raise exception 'Clarification changed; refresh first' using errcode='40001'; end if;
    if char_length(trim(action_note)) not between 3 and 4000 then raise exception 'Add the missing context' using errcode='22023'; end if;
    update public.question_clarifications set status='answered',reply=trim(action_note),answered_at=now() where id=clarification.id;
    insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
      select target_organization_id,m.user_id,'expert_answer_needed','A question has new context',q.question,
        '/app/needs-you?item=question-'||q.id::text,'question',q.id,'answer','/app/needs-you?item=question-'||q.id::text
      from public.organization_members m where m.organization_id=target_organization_id
        and ((q.assigned_expert_id is not null and m.user_id=q.assigned_expert_id)
          or (q.assigned_expert_id is null and m.permission_level in ('owner','admin')));
    return jsonb_build_object('ok',true);
  end if;
  if not admin and q.assigned_expert_id is distinct from actor then raise exception 'This question is assigned to another person' using errcode='42501'; end if;
  if q.status <> 'needs_owner' then raise exception 'Question already resolved' using errcode='40001'; end if;
  if question_action='reroute' then
    if not admin then raise exception 'Only administrators can reassign questions' using errcode='42501'; end if;
    if target_expert_id is not null and not exists(select 1 from public.organization_members m
      where m.user_id=target_expert_id and m.organization_id=target_organization_id) then
      raise exception 'Choose a person in this workspace' using errcode='22023';
    end if;
    if q.assigned_expert_id is not distinct from target_expert_id and q.escalated then return jsonb_build_object('ok',true); end if;
    update public.employee_questions set assigned_expert_id=target_expert_id,assigned_expert_rule_id=null,escalated=false where id=q.id;
    update public.employee_questions set escalated=true where id=q.id;
    insert into public.knowledge_events(organization_id,event_type,actor_id,question_id,metadata)
      values(target_organization_id,'question_escalated',actor,q.id,jsonb_build_object('action','reroute','assigned_expert_id',target_expert_id));
  elsif question_action='dismiss' then
    if char_length(trim(action_note)) not between 3 and 2000 then raise exception 'Add a dismissal reason' using errcode='22023'; end if;
    update public.employee_questions set status='dismissed',resolved_at=now() where id=q.id;
    update public.question_clarifications set status='canceled' where question_id=q.id and status='open';
    insert into public.knowledge_events(organization_id,event_type,actor_id,question_id,metadata)
      values(target_organization_id,'needs_you_resolved',actor,q.id,jsonb_build_object('action','dismiss_question','reason',trim(action_note)));
  elsif question_action='request_clarification' then
    if char_length(trim(action_note)) not between 3 and 2000 then raise exception 'Ask for the missing context' using errcode='22023'; end if;
    if exists(select 1 from public.question_clarifications where question_id=q.id and status='open') then
      raise exception 'A clarification is already waiting for a reply' using errcode='40001';
    end if;
    insert into public.question_clarifications(organization_id,question_id,requested_by,message)
      values(target_organization_id,q.id,actor,trim(action_note)) returning * into clarification;
    update public.question_clusters set classification='clarification_needed' where id=q.cluster_id and organization_id=target_organization_id;
    insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
      values(target_organization_id,q.asked_by,'question_answered','More context is needed',trim(action_note),'/app/ask',
        'question',q.id,'view','/app/ask');
  else raise exception 'Invalid action' using errcode='22023'; end if;
  return jsonb_build_object('ok',true,'clarificationId',clarification.id);
end; $$;
revoke all on function public.manage_gap_question(uuid,uuid,text,uuid,text,uuid) from public,anon;
grant execute on function public.manage_gap_question(uuid,uuid,text,uuid,text,uuid) to authenticated;
