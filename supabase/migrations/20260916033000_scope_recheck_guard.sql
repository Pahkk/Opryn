-- Final commit-time applicability check complements the existing permission guard.
create function public.guard_scoped_gap_recheck() returns trigger
language plpgsql set search_path='' as $$
declare context jsonb; member_role uuid; role_name text; channel text;
begin
  if new.status<>'answered' then return new; end if;
  if new.question_id is not null then
    select q.scope_context,m.role_id,q.origin into context,member_role,channel
      from public.employee_questions q join public.organization_members m
      on m.organization_id=q.organization_id and m.user_id=q.asked_by
      where q.id=new.question_id and q.organization_id=new.organization_id;
    if not found then raise exception 'Question access changed' using errcode='23514'; end if;
    select name into role_name from public.roles where id=member_role and organization_id=new.organization_id;
    context:=context||jsonb_build_object('channels',jsonb_build_array(channel),'roles',
      case when member_role is null then '[]'::jsonb when role_name is null then jsonb_build_array(member_role::text)
      else jsonb_build_array(member_role::text,role_name) end);
  else
    select e.scope_context||jsonb_build_object('channels',jsonb_build_array('external_ai')) into context
      from public.external_ai_escalations e where e.id=new.external_escalation_id and e.organization_id=new.organization_id;
    if not found then raise exception 'Interaction unavailable' using errcode='23514'; end if;
  end if;
  if exists(select 1 from unnest(new.cited_knowledge_ids) cited
    left join public.knowledge_chunks k on k.id=cited and k.organization_id=new.organization_id
    where k.id is null or public.knowledge_scope_match(k.scope,context,(now() at time zone 'UTC')::date)<>'matches') then
    raise exception 'Approved guidance no longer applies to original context' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger scoped_gap_recheck before insert or update on public.knowledge_gap_rechecks
  for each row execute function public.guard_scoped_gap_recheck();
