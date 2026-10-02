-- Automatic routing uses existing workspace escalation permissions and notification triggers.
-- One unread request per cluster/recipient/day prevents repeated-question notification noise.
create or replace function public.notify_owners_of_question() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_url text; recipient uuid;
begin
  if new.status <> 'needs_owner' or not new.escalated then return new; end if;
  if tg_op='UPDATE' and old.escalated then return new; end if;
  if new.cluster_id is not null then
    perform 1 from public.question_clusters where id=new.cluster_id and organization_id=new.organization_id for update;
  end if;
  target_url := '/app/needs-you?item=question-' || new.id::text;
  for recipient in
    select m.user_id from public.organization_members m where m.organization_id=new.organization_id
      and ((new.assigned_expert_id is not null and m.user_id=new.assigned_expert_id)
        or (new.assigned_expert_id is null and m.permission_level in ('owner','admin')))
  loop
    if new.cluster_id is not null and exists (
      select 1 from public.notifications n join public.employee_questions previous
        on previous.id=n.entity_id and previous.organization_id=n.organization_id
      where n.organization_id=new.organization_id and n.user_id=recipient and n.entity_type='question'
        and n.read=false and n.created_at>now()-interval '24 hours'
        and previous.id<>new.id and previous.cluster_id=new.cluster_id
        and previous.status='needs_owner' and previous.escalated) then
      continue;
    end if;
    insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
    values(new.organization_id,recipient,
      case when new.assigned_expert_id is null then 'employee_question' else 'expert_answer_needed' end,
      'A knowledge gap needs your answer',new.question,target_url,'question',new.id,'answer',target_url);
  end loop;
  return new;
end; $$;
