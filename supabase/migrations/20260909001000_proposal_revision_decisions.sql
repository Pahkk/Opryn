-- Exact-revision, atomic decisions for the existing shared proposal workflow.
-- No new knowledge store; embeddings are prepared before entering this transaction.
create or replace function public.bump_knowledge_proposal_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.title,new.proposed_content,new.risk_level,new.review_reason,new.existing_knowledge_id)
    is distinct from row(old.title,old.proposed_content,old.risk_level,old.review_reason,old.existing_knowledge_id) then
    new.version := old.version + 1;
  end if;
  return new;
end; $$;
drop trigger if exists knowledge_proposal_revision on public.knowledge_proposals;
create trigger knowledge_proposal_revision before update on public.knowledge_proposals
for each row execute function public.bump_knowledge_proposal_revision();

create or replace function public.decide_knowledge_proposal(
  target_organization_id uuid, target_proposal_id uuid, actor_id uuid,
  expected_version integer, expected_updated_at timestamptz,
  decision text, decision_source text, prepared_embedding extensions.vector(1536) default null,
  rejection_reason text default null, expected_knowledge_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.knowledge_proposals; k public.knowledge_chunks; knowledge_id uuid;
  content_value text; source_value text; process_role_id uuid; next_version integer; event_value text;
begin
  if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or auth.uid() <> actor_id) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members m where m.organization_id = target_organization_id
    and m.user_id = actor_id and m.permission_level in ('owner','admin')) then
    raise exception 'Owner or admin required' using errcode = '42501';
  end if;
  if decision not in ('approved','rejected','answer_only') or decision_source not in ('web','chatgpt','claude','external_ai') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || actor_id::text || 'proposal',0));
  if (select count(*) from public.knowledge_events e where e.organization_id = target_organization_id and e.actor_id = decide_knowledge_proposal.actor_id
    and e.event_type in ('proposal_approved','proposal_rejected','proposal_answer_only') and e.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many decisions. Try again shortly.' using errcode = '53300';
  end if;
  select * into p from public.knowledge_proposals where organization_id = target_organization_id and id = target_proposal_id for update;
  if not found then raise exception 'Proposal not found' using errcode = 'P0002'; end if;
  if expected_version is null or p.version <> expected_version or expected_updated_at is null or p.updated_at <> expected_updated_at then
    raise exception 'This proposal changed. Review the latest revision.' using errcode = '40001';
  end if;
  if p.status not in ('pending_approval','needs_review') then
    raise exception 'This proposal was already resolved.' using errcode = '40001';
  end if;
  if decision = 'approved' then
    if p.status <> 'pending_approval' or prepared_embedding is null then
      raise exception 'Individual review is required.' using errcode = '23514';
    end if;
    content_value := p.title || ': ' || p.proposed_content;
    source_value := case p.source_type when 'call' then 'call_finding' when 'document' then 'external_ai' else p.source_type end;
    -- The underlying rule must still be the one displayed by the proposal.
    if p.related_process_id is not null then
      perform 1 from public.processes where id = p.related_process_id and organization_id = target_organization_id for share;
      if not found then raise exception 'Source process not found' using errcode = 'P0002'; end if;
      if (select count(*) from public.process_role_assignments where process_id = p.related_process_id and organization_id = target_organization_id) > 1 then
        raise exception 'Review the process access groups before approving this policy.' using errcode = '23514';
      end if;
      select role_id into process_role_id from public.process_role_assignments where process_id = p.related_process_id and organization_id = target_organization_id for share;
    end if;
    if p.process_rule_id is not null then
      perform 1 from public.process_rules r where r.id = p.process_rule_id and r.organization_id = target_organization_id
        and r.title = p.title and r.text = p.proposed_content for update;
      if not found then raise exception 'The source rule changed. Review the process.' using errcode = '40001'; end if;
    end if;
    if p.existing_knowledge_id is not null then
      select * into k from public.knowledge_chunks where id = p.existing_knowledge_id and organization_id = target_organization_id for update;
      if not found or expected_knowledge_version is null or k.current_version <> expected_knowledge_version then
        raise exception 'Existing knowledge changed. Review the latest version.' using errcode = '40001';
      end if;
      if k.health_status = 'conflict' or exists(select 1 from public.knowledge_conflicts c where c.organization_id = target_organization_id
        and c.status = 'open' and c.conflict_type = 'conflict' and (c.knowledge_chunk_a = k.id or c.knowledge_chunk_b = k.id)) then
        raise exception 'Resolve the knowledge conflict first.' using errcode = '23514';
      end if;
      insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,title,content,changed_by,change_reason)
        values(target_organization_id,k.id,k.current_version,p.title,k.content,actor_id,'Previous version before proposal acceptance') on conflict(knowledge_chunk_id,version_number) do nothing;
      next_version := k.current_version + 1;
      update public.knowledge_chunks set content = content_value, embedding = prepared_embedding, approved = true,
        current_version = next_version, last_confirmed_at = now(), health_status = 'healthy', criticality = p.risk_level
        where id = k.id and organization_id = target_organization_id;
      knowledge_id := k.id;
    else
      next_version := 1;
      insert into public.knowledge_chunks(organization_id,content,embedding,source_type,source_id,process_id,rule_id,role_id,approved,current_version,last_confirmed_at,health_status,criticality)
        values(target_organization_id,content_value,prepared_embedding,source_value,p.id,p.related_process_id,p.process_rule_id,process_role_id,true,1,now(),'healthy',p.risk_level)
        returning id into knowledge_id;
    end if;
    insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,title,content,changed_by,change_reason)
      values(target_organization_id,knowledge_id,next_version,p.title,content_value,actor_id,'Knowledge proposal accepted');
    update public.process_rules set status = 'approved', approved_by = actor_id, approved_at = now()
      where id = p.process_rule_id and organization_id = target_organization_id;
    update public.knowledge_proposals set status = 'approved',approved_by = actor_id,approved_at = now(),approved_knowledge_id = knowledge_id where id = p.id;
    event_value := 'proposal_approved';
  else
    update public.knowledge_proposals set status = decision,rejected_by = actor_id,rejected_at = now(),
      rejection_reason = left(decide_knowledge_proposal.rejection_reason,1000) where id = p.id;
    -- Never revoke a previously approved rule merely by denying a later proposal.
    update public.process_rules set status = 'rejected' where id = p.process_rule_id and organization_id = target_organization_id and status <> 'approved';
    event_value := case decision when 'answer_only' then 'proposal_answer_only' else 'proposal_rejected' end;
  end if;
  insert into public.knowledge_events(organization_id,event_type,actor_id,knowledge_chunk_id,source_type,source_id,metadata)
    values(target_organization_id,event_value,actor_id,knowledge_id,decision_source,p.id,jsonb_build_object('proposal_id',p.id,'version',p.version,'resolved_from',decision_source));
  if decision = 'approved' then
    insert into public.knowledge_events(organization_id,event_type,actor_id,knowledge_chunk_id,source_type,source_id,metadata)
      values(target_organization_id,'approved_from_' || decision_source,actor_id,knowledge_id,decision_source,p.id,jsonb_build_object('version',p.version));
  end if;
  insert into public.knowledge_events(organization_id,event_type,actor_id,source_type,source_id,metadata)
    values(target_organization_id,'needs_you_resolved',actor_id,decision_source,p.id,jsonb_build_object('version',p.version));
  update public.notifications set read = true where organization_id = target_organization_id and entity_type = 'knowledge_proposal' and entity_id = p.id;
  return jsonb_build_object('id',p.id,'title',p.title,'content',p.proposed_content,'status',decision,'knowledgeId',knowledge_id);
end; $$;
revoke all on function public.decide_knowledge_proposal(uuid,uuid,uuid,integer,timestamptz,text,text,extensions.vector,text,integer) from public, anon;
grant execute on function public.decide_knowledge_proposal(uuid,uuid,uuid,integer,timestamptz,text,text,extensions.vector,text,integer) to authenticated, service_role;
