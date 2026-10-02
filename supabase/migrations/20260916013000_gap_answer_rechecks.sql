-- Durable rechecks extend the existing question/proposal loop, not a second inbox.
create table public.knowledge_gap_rechecks (
  proposal_id uuid not null references public.knowledge_proposals(id) on delete cascade,
  question_id uuid not null references public.employee_questions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','answered','unknown','error')),
  answer text,
  cited_knowledge_ids uuid[] not null default '{}',
  knowledge_version integer,
  checked_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (proposal_id,question_id)
);
alter table public.knowledge_gap_rechecks enable row level security;
create policy gap_rechecks_admin_read on public.knowledge_gap_rechecks for select to authenticated
  using (public.is_org_admin(organization_id));
grant select on public.knowledge_gap_rechecks to authenticated;
grant all on public.knowledge_gap_rechecks to service_role;

create function public.queue_knowledge_gap_rechecks() returns trigger
language plpgsql security definer set search_path='' as $$
declare original public.employee_questions;
begin
  if new.status='approved' and old.status is distinct from 'approved' and new.related_question_id is not null then
    select * into original from public.employee_questions
      where id=new.related_question_id and organization_id=new.organization_id;
    if found then
      insert into public.knowledge_gap_rechecks(proposal_id,question_id,organization_id)
        select new.id,q.id,new.organization_id from public.employee_questions q
        where q.organization_id=new.organization_id and (q.id=original.id or
          (original.cluster_id is not null and q.cluster_id=original.cluster_id))
        on conflict do nothing;
    end if;
  end if;
  return new;
end; $$;
create trigger queue_knowledge_gap_rechecks after update of status on public.knowledge_proposals
  for each row execute function public.queue_knowledge_gap_rechecks();

-- Atomic short-lived claims bound model work and suppress parallel/repeated retries.
create function public.claim_knowledge_gap_rechecks(target_organization_id uuid,target_proposal_id uuid)
returns table(question_id uuid) language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Server verification required' using errcode='42501';
  end if;
  return query with candidates as (
    select r.proposal_id,r.question_id from public.knowledge_gap_rechecks r
      join public.knowledge_proposals p on p.id=r.proposal_id and p.organization_id=r.organization_id
    where r.organization_id=target_organization_id and r.proposal_id=target_proposal_id
      and p.status='approved' and r.status <> 'answered'
      and (r.last_attempt_at is null or r.last_attempt_at<now()-interval '5 minutes')
    order by (r.status='pending') desc,r.checked_at nulls first,r.question_id
    limit 10 for update of r skip locked
  ) update public.knowledge_gap_rechecks r set last_attempt_at=now() from candidates c
    where r.proposal_id=c.proposal_id and r.question_id=c.question_id returning r.question_id;
end; $$;
revoke all on function public.claim_knowledge_gap_rechecks(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_knowledge_gap_rechecks(uuid,uuid) to service_role;

-- Only the server may report model/retrieval evidence. Browsers cannot assert success.
create function public.complete_knowledge_gap_recheck(
  target_organization_id uuid,target_proposal_id uuid,target_question_id uuid,
  result_status text,result_answer text,result_citations uuid[],expected_knowledge_version integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.knowledge_proposals; q public.employee_questions; k public.knowledge_chunks;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Server verification required' using errcode='42501';
  end if;
  if result_status not in ('answered','unknown','error') then
    raise exception 'Invalid result' using errcode='22023';
  end if;
  select * into p from public.knowledge_proposals where id=target_proposal_id
    and organization_id=target_organization_id and status='approved' for share;
  if not found then raise exception 'Approved proposal not found' using errcode='P0002'; end if;
  select * into q from public.employee_questions where id=target_question_id
    and organization_id=target_organization_id for share;
  if not found then raise exception 'Question not found' using errcode='P0002'; end if;
  select * into k from public.knowledge_chunks where id=p.approved_knowledge_id
    and organization_id=target_organization_id for share;
  if result_status='answered' and (k.id is null or not k.approved or k.health_status <> 'healthy'
    or expected_knowledge_version is distinct from k.current_version
    or nullif(trim(result_answer),'') is null
    or not (k.id=any(coalesce(result_citations,'{}'::uuid[])))
    or not exists(select 1 from public.organization_members m where m.organization_id=target_organization_id and m.user_id=q.asked_by)
    or exists(select 1 from public.organization_settings s where s.organization_id=target_organization_id and s.employees_can_ask=false)
    or public.knowledge_context_requires_review(target_organization_id,result_citations) is distinct from false
    or exists(select 1 from unnest(result_citations) id where not exists(
      select 1 from public.knowledge_chunks c join public.organization_members m
        on m.organization_id=c.organization_id and m.user_id=q.asked_by
        where c.id=id and c.organization_id=target_organization_id and c.approved
          and (m.permission_level in ('owner','admin') or c.role_id is null or c.role_id=m.role_id)))) then
    raise exception 'Verified current approved sources required' using errcode='23514';
  end if;
  update public.knowledge_gap_rechecks set status=result_status,
    answer=case when result_status='answered' then result_answer else null end,
    cited_knowledge_ids=case when result_status='answered' then result_citations else '{}'::uuid[] end,
    knowledge_version=expected_knowledge_version,checked_at=now()
    where proposal_id=p.id and question_id=q.id and organization_id=target_organization_id;
  if not found then raise exception 'Recheck not queued' using errcode='P0002'; end if;
  if q.cluster_id is null then return false; end if;
  -- Serialize closure; new or unverified questions and newer knowledge prevent it.
  perform 1 from public.question_clusters where id=q.cluster_id and organization_id=target_organization_id for update;
  if result_status='answered'
    and (select c.question_count from public.question_clusters c where c.id=q.cluster_id and c.organization_id=target_organization_id)
      = (select count(*) from public.employee_questions recorded where recorded.cluster_id=q.cluster_id and recorded.organization_id=target_organization_id)
    and not exists (
    select 1 from public.employee_questions question where question.organization_id=target_organization_id
      and question.cluster_id=q.cluster_id and not exists (
        select 1 from public.knowledge_gap_rechecks r where r.question_id=question.id and r.proposal_id=p.id
          and r.organization_id=target_organization_id and r.status='answered'
          and r.knowledge_version=k.current_version)) then
    update public.question_clusters set status='resolved',resolved_by_knowledge_id=k.id,updated_at=now()
      where id=q.cluster_id and organization_id=target_organization_id and status <> 'dismissed';
    return found;
  end if;
  update public.question_clusters set status='open',resolved_by_knowledge_id=null,updated_at=now()
    where id=q.cluster_id and organization_id=target_organization_id
      and status='resolved' and resolved_by_knowledge_id=p.approved_knowledge_id;
  return false;
end; $$;
revoke all on function public.complete_knowledge_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) from public,anon,authenticated;
grant execute on function public.complete_knowledge_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) to service_role;
