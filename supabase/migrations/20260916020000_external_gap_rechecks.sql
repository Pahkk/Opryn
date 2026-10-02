-- Keep one durable verification queue, with real team OR external interaction identity.
alter table public.knowledge_gap_rechecks add column id uuid not null default gen_random_uuid(),
  add column attempt_count integer not null default 0,
  add column external_escalation_id uuid references public.external_ai_escalations(id) on delete cascade;
alter table public.knowledge_gap_rechecks drop constraint knowledge_gap_rechecks_pkey;
alter table public.knowledge_gap_rechecks alter column question_id drop not null;
alter table public.knowledge_gap_rechecks add primary key(id),
  add unique(proposal_id,question_id), add unique(proposal_id,external_escalation_id),
  add check ((question_id is null) <> (external_escalation_id is null));
alter table public.external_ai_escalations add column origin_api_key_id uuid
  references public.external_ai_api_keys(id) on delete set null;

create or replace function public.queue_knowledge_gap_rechecks() returns trigger
language plpgsql security definer set search_path='' as $$
declare cluster uuid;
begin
  if new.status <> 'approved' or old.status='approved' then return new; end if;
  select q.cluster_id into cluster from public.employee_questions q
    where q.id=new.related_question_id and q.organization_id=new.organization_id;
  if cluster is null then
    select e.cluster_id into cluster from public.external_ai_escalations e
      where new.source_type='owner_answer' and e.id=new.source_id and e.organization_id=new.organization_id;
  end if;
  insert into public.knowledge_gap_rechecks(proposal_id,question_id,organization_id)
    select new.id,q.id,new.organization_id from public.employee_questions q
    where q.organization_id=new.organization_id and (q.id=new.related_question_id or (cluster is not null and q.cluster_id=cluster))
    on conflict do nothing;
  insert into public.knowledge_gap_rechecks(proposal_id,external_escalation_id,organization_id)
    select new.id,e.id,new.organization_id from public.external_ai_escalations e
    where e.organization_id=new.organization_id and ((new.source_type='owner_answer' and e.id=new.source_id)
      or (cluster is not null and e.cluster_id=cluster)) on conflict do nothing;
  return new;
end; $$;

create or replace function public.claim_knowledge_gap_rechecks(target_organization_id uuid,target_proposal_id uuid)
returns table(question_id uuid) language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  return query with candidates as (
    select r.id from public.knowledge_gap_rechecks r join public.knowledge_proposals p
      on p.id=r.proposal_id and p.organization_id=r.organization_id
    where r.organization_id=target_organization_id and r.proposal_id=target_proposal_id and r.question_id is not null
      and p.status='approved' and r.status <> 'answered'
      and (r.last_attempt_at is null or r.last_attempt_at<now()-interval '5 minutes')
    order by (r.status='pending') desc,r.checked_at nulls first,r.id limit 10 for update of r skip locked
  ) update public.knowledge_gap_rechecks r set last_attempt_at=now(),attempt_count=attempt_count+1 from candidates c where r.id=c.id returning r.question_id;
end; $$;

create function public.claim_external_gap_rechecks(target_organization_id uuid,target_proposal_id uuid)
returns table(external_escalation_id uuid) language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  return query with candidates as (
    select r.id from public.knowledge_gap_rechecks r join public.knowledge_proposals p
      on p.id=r.proposal_id and p.organization_id=r.organization_id
    where r.organization_id=target_organization_id and r.proposal_id=target_proposal_id and r.external_escalation_id is not null
      and p.status='approved' and r.status <> 'answered'
      and (r.last_attempt_at is null or r.last_attempt_at<now()-interval '5 minutes')
    order by (r.status='pending') desc,r.checked_at nulls first,r.id limit 10 for update of r skip locked
  ) update public.knowledge_gap_rechecks r set last_attempt_at=now(),attempt_count=attempt_count+1 from candidates c where r.id=c.id returning r.external_escalation_id;
end; $$;
revoke all on function public.claim_external_gap_rechecks(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_external_gap_rechecks(uuid,uuid) to service_role;

-- Team and external proofs must cover every actual recorded occurrence; unrecorded ones fail closed.
create function public.refresh_gap_resolution(target_org uuid,target_proposal uuid,target_cluster uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.knowledge_proposals; k public.knowledge_chunks; c public.question_clusters; complete boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  select * into p from public.knowledge_proposals where id=target_proposal and organization_id=target_org and status='approved';
  select * into k from public.knowledge_chunks where id=p.approved_knowledge_id and organization_id=target_org for share;
  select * into c from public.question_clusters where id=target_cluster and organization_id=target_org for update;
  if c.id is null or c.status='dismissed' then return false; end if;
  complete := k.id is not null and k.approved and k.health_status='healthy'
    and c.question_count=(select count(*) from public.employee_questions q where q.cluster_id=c.id and q.organization_id=target_org)
      +(select count(*) from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=target_org)
    and not exists(select 1 from public.employee_questions q where q.cluster_id=c.id and q.organization_id=target_org
      and not exists(select 1 from public.knowledge_gap_rechecks r where r.proposal_id=p.id and r.organization_id=target_org
        and r.question_id=q.id and r.status='answered' and r.knowledge_version=k.current_version))
    and not exists(select 1 from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=target_org
      and not exists(select 1 from public.knowledge_gap_rechecks r where r.proposal_id=p.id and r.organization_id=target_org
        and r.external_escalation_id=e.id and r.status='answered' and r.knowledge_version=k.current_version));
  if complete then
    update public.question_clusters set status='resolved',resolved_by_knowledge_id=k.id,updated_at=now() where id=c.id;
  elsif c.resolved_by_knowledge_id=p.approved_knowledge_id then
    update public.question_clusters set status='open',resolved_by_knowledge_id=null,updated_at=now() where id=c.id;
  end if;
  return complete;
end; $$;
revoke all on function public.refresh_gap_resolution(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.refresh_gap_resolution(uuid,uuid,uuid) to service_role;

-- Retain the tested team evidence validation; finish with mixed-channel closure validation.
alter function public.complete_knowledge_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer)
  rename to complete_team_gap_recheck_evidence;
create function public.complete_knowledge_gap_recheck(target_organization_id uuid,target_proposal_id uuid,target_question_id uuid,
  result_status text,result_answer text,result_citations uuid[],expected_knowledge_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare cluster uuid;
begin
  perform public.complete_team_gap_recheck_evidence(target_organization_id,target_proposal_id,target_question_id,
    result_status,result_answer,result_citations,expected_knowledge_version);
  select cluster_id into cluster from public.employee_questions where id=target_question_id and organization_id=target_organization_id;
  return public.refresh_gap_resolution(target_organization_id,target_proposal_id,cluster);
end; $$;
revoke all on function public.complete_knowledge_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) from public,anon,authenticated;
grant execute on function public.complete_knowledge_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) to service_role;

create function public.complete_external_gap_recheck(target_organization_id uuid,target_proposal_id uuid,target_escalation_id uuid,
  result_status text,result_answer text,result_citations uuid[],expected_knowledge_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.knowledge_proposals; e public.external_ai_escalations; k public.knowledge_chunks;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  if result_status not in ('answered','unknown','error') then raise exception 'Invalid result' using errcode='22023'; end if;
  select * into p from public.knowledge_proposals where id=target_proposal_id and organization_id=target_organization_id and status='approved' for share;
  select * into e from public.external_ai_escalations where id=target_escalation_id and organization_id=target_organization_id for share;
  if p.id is null or e.id is null then raise exception 'Interaction not found' using errcode='P0002'; end if;
  select * into k from public.knowledge_chunks where id=p.approved_knowledge_id and organization_id=target_organization_id for share;
  if result_status='answered' and (k.id is null or not k.approved or k.health_status <> 'healthy'
    or expected_knowledge_version is distinct from k.current_version or nullif(trim(result_answer),'') is null
    or not(k.id=any(coalesce(result_citations,'{}'::uuid[])))
    or public.knowledge_context_requires_review(target_organization_id,result_citations) is distinct from false
    or not exists(select 1 from public.organization_subscriptions s where s.organization_id=target_organization_id
      and s.plan='premium' and s.status in ('active','trialing') and s.stripe_subscription_id is not null)
    or not exists(select 1 from public.external_ai_connections c join public.external_ai_api_keys a
      on a.connection_id=c.id and a.organization_id=c.organization_id
      where c.id=e.connection_id and c.organization_id=target_organization_id and c.status='active'
        and a.id=e.origin_api_key_id and a.revoked_at is null)
    or not exists(select 1 from public.external_ai_scopes s where s.connection_id=e.connection_id
      and s.organization_id=target_organization_id and s.scope='knowledge:read')
    or exists(select 1 from unnest(result_citations) as citation(knowledge_id) where not exists(
      select 1 from public.knowledge_chunks chunk join public.external_ai_connections c on c.id=e.connection_id
      where c.organization_id=target_organization_id and chunk.organization_id=target_organization_id and chunk.id=citation.knowledge_id
        and chunk.approved and chunk.health_status='healthy' and chunk.library_archived_at is null
        and (chunk.source_type not in ('owner_answer','rule') or exists(select 1 from public.external_ai_scopes s
          where s.connection_id=c.id and s.organization_id=c.organization_id and s.scope='policies:read'))
        and (chunk.source_type not in ('process_summary','process_step','exception') or exists(select 1 from public.external_ai_scopes s
          where s.connection_id=c.id and s.organization_id=c.organization_id and s.scope='processes:read'))
        and (c.knowledge_mode='all_approved' or exists(select 1 from public.external_ai_knowledge_access a
          where a.connection_id=c.id and a.organization_id=c.organization_id and a.source_type=chunk.source_type
            and (a.source_id is null or a.source_id in (chunk.source_id,chunk.process_id,chunk.rule_id,chunk.role_id))))))) then
    raise exception 'Verified accessible current sources required' using errcode='23514';
  end if;
  update public.knowledge_gap_rechecks set status=result_status,answer=case when result_status='answered' then result_answer else null end,
    cited_knowledge_ids=case when result_status='answered' then result_citations else '{}'::uuid[] end,
    knowledge_version=expected_knowledge_version,checked_at=now()
    where proposal_id=p.id and external_escalation_id=e.id and organization_id=target_organization_id;
  if not found then raise exception 'Recheck not queued' using errcode='P0002'; end if;
  return public.refresh_gap_resolution(target_organization_id,target_proposal_id,e.cluster_id);
end; $$;
revoke all on function public.complete_external_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) from public,anon,authenticated;
grant execute on function public.complete_external_gap_recheck(uuid,uuid,uuid,text,text,uuid[],integer) to service_role;

create function public.list_due_gap_recheck_batches()
returns table(organization_id uuid,proposal_id uuid) language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  return query select r.organization_id,r.proposal_id from public.knowledge_gap_rechecks r
    join public.knowledge_proposals p on p.id=r.proposal_id and p.organization_id=r.organization_id
    where p.status='approved' and r.status in ('pending','error') and r.attempt_count<3
      and (r.last_attempt_at is null or r.last_attempt_at<now()-interval '15 minutes')
    group by r.organization_id,r.proposal_id order by min(r.last_attempt_at) nulls first,min(r.created_at),r.proposal_id limit 2;
end; $$;
revoke all on function public.list_due_gap_recheck_batches() from public,anon,authenticated;
grant execute on function public.list_due_gap_recheck_batches() to service_role;

create function public.claim_scheduled_gap_rechecks(target_organization_id uuid,target_proposal_id uuid,external_jobs boolean)
returns table(question_id uuid,external_escalation_id uuid) language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server verification required' using errcode='42501'; end if;
  return query with candidates as (
    select r.id from public.knowledge_gap_rechecks r join public.knowledge_proposals p
      on p.id=r.proposal_id and p.organization_id=r.organization_id
    where r.organization_id=target_organization_id and r.proposal_id=target_proposal_id and p.status='approved'
      and (r.external_escalation_id is not null)=external_jobs and r.status in ('pending','error') and r.attempt_count<3
      and (r.last_attempt_at is null or r.last_attempt_at<now()-interval '15 minutes')
    order by r.last_attempt_at nulls first,r.created_at,r.id limit 10 for update of r skip locked
  ) update public.knowledge_gap_rechecks r set last_attempt_at=now(),attempt_count=attempt_count+1
    from candidates c where r.id=c.id returning r.question_id,r.external_escalation_id;
end; $$;
revoke all on function public.claim_scheduled_gap_rechecks(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_scheduled_gap_rechecks(uuid,uuid,boolean) to service_role;

-- Explicit citation alias also avoids collision with organization_members.id in the real schema.
create or replace function public.complete_team_gap_recheck_evidence(
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
    or exists(select 1 from unnest(result_citations) as citation(knowledge_id) where not exists(
      select 1 from public.knowledge_chunks c join public.organization_members m
        on m.organization_id=c.organization_id and m.user_id=q.asked_by
        where c.id=citation.knowledge_id and c.organization_id=target_organization_id and c.approved
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
