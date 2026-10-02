-- Publication, version snapshots and source promotion commit or roll back together.
create function public.publish_process_knowledge(target_org uuid,target_process uuid,
  expected_updated_at timestamptz,prepared_chunks jsonb,expected_versions jsonb)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare p public.processes; k public.knowledge_chunks; item jsonb; kid uuid;
  active_ids uuid[]='{}'; next_version integer; v_source_type text; role uuid; stamp timestamptz=now();
begin
  if auth.uid() is null or not public.is_org_admin(target_org) then
    raise exception 'Owner or admin permission required' using errcode='42501'; end if;
  select * into p from public.processes where organization_id=target_org and id=target_process for update;
  if not found then raise exception 'Process unavailable' using errcode='P0002'; end if;
  if p.updated_at is distinct from expected_updated_at or p.library_archived_at is not null then
    raise exception 'Process changed. Review the latest version.' using errcode='40001'; end if;
  if jsonb_typeof(prepared_chunks)<>'array' or jsonb_array_length(prepared_chunks) not between 1 and 500 then
    raise exception 'Invalid prepared knowledge' using errcode='22023'; end if;
  -- Do not widen access/applicability when regenerating scoped source content.
  -- These cases use the existing per-item versioned review instead.
  if p.supersedes_process_id is not null and exists(select 1 from public.knowledge_chunks
    where organization_id=target_org and process_id=p.supersedes_process_id and approved
      and (scope<>'{}' or role_id is not null)) then
    raise exception 'This source has scoped guidance. Update its existing knowledge through per-item review to preserve access and applicability.' using errcode='23514'; end if;
  if p.supersedes_process_id is not null and exists(select 1 from public.knowledge_conflicts f
    join public.knowledge_chunks c on c.id in(f.knowledge_chunk_a,f.knowledge_chunk_b) and c.organization_id=f.organization_id
    where f.organization_id=target_org and f.status='open' and f.conflict_type='conflict' and c.process_id=p.supersedes_process_id) then
    raise exception 'Resolve the source baseline conflict first' using errcode='23514'; end if;
  perform 1 from public.knowledge_chunks where organization_id=target_org and process_id=target_process order by id for update;
  if exists(select 1 from public.knowledge_chunks c where c.organization_id=target_org and c.process_id=target_process
      and (expected_versions->>c.id::text)::integer is distinct from c.current_version)
    or exists(select 1 from public.knowledge_chunks c where c.organization_id=target_org and c.process_id=target_process
      and (c.health_status='conflict' or exists(select 1 from public.knowledge_conflicts f where f.organization_id=target_org
        and f.status='open' and f.conflict_type='conflict' and c.id in(f.knowledge_chunk_a,f.knowledge_chunk_b)))) then
    raise exception 'Knowledge changed or has an unresolved conflict' using errcode='40001'; end if;
  select case when count(*)=1 then (array_agg(role_id))[1] else null end into role
    from public.process_role_assignments where organization_id=target_org and process_id=target_process;
  for item in select value from jsonb_array_elements(prepared_chunks) loop
    v_source_type=item->>'source_type';
    -- Prepared text must still match the reviewed process and child records.
    if not (
      ((item->>'source_id')::uuid=p.id and item->>'content'=concat(p.title,'. ',p.summary,E'\nPurpose: ',p.purpose))
      or exists(select 1 from public.process_steps s where s.organization_id=target_org and s.process_id=p.id
        and s.id=(item->>'source_id')::uuid and item->>'content'=concat(p.title,', step ',s.step_order,': ',s.title,'. ',s.description))
      or exists(select 1 from public.process_rules r where r.organization_id=target_org and r.process_id=p.id
        and r.id=(item->>'source_id')::uuid and item->>'content'=concat(r.title,': ',r.text))
      or exists(select 1 from public.process_exceptions e where e.organization_id=target_org and e.process_id=p.id
        and e.id=(item->>'source_id')::uuid and item->>'content'=concat(p.title,' exception: ',e.text))
    ) then raise exception 'Reviewed content changed' using errcode='40001'; end if;
    if v_source_type not in('google_drive','notion','confluence','process_summary','process_step','rule','exception') then
      raise exception 'Invalid source type' using errcode='22023'; end if;
    select * into k from public.knowledge_chunks where organization_id=target_org and process_id=p.id
      and source_id=(item->>'source_id')::uuid and knowledge_chunks.source_type=v_source_type for update;
    if found then
      kid=k.id;
      next_version=k.current_version+case when k.content is distinct from item->>'content' then 1 else 0 end;
      insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,title,content,scope,changed_by,change_reason)
        values(target_org,kid,k.current_version,p.title,k.content,k.scope,auth.uid(),'Previous process version')
        on conflict(knowledge_chunk_id,version_number) do nothing;
      update public.knowledge_chunks set content=item->>'content',embedding=(item->'embedding')::text::extensions.vector,
        role_id=role,approved=true,current_version=next_version,last_confirmed_at=stamp,health_status='healthy',criticality=p.criticality
        where id=kid and organization_id=target_org;
    else
      next_version=1;
      insert into public.knowledge_chunks(organization_id,content,embedding,source_type,source_id,process_id,rule_id,role_id,
        approved,current_version,last_confirmed_at,health_status,criticality)
      values(target_org,item->>'content',(item->'embedding')::text::extensions.vector,v_source_type,
        (item->>'source_id')::uuid,p.id,(item->>'rule_id')::uuid,role,true,1,stamp,'healthy',p.criticality) returning id into kid;
    end if;
    insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,title,content,scope,changed_by,change_reason)
      select target_org,kid,next_version,p.title,item->>'content',scope,auth.uid(),'Process approved'
      from public.knowledge_chunks where id=kid and organization_id=target_org
      on conflict(knowledge_chunk_id,version_number) do nothing;
    active_ids=array_append(active_ids,kid);
  end loop;
  -- Also guard omitted/duplicated child records rather than publishing a partial process.
  if cardinality(active_ids)<>1+(select count(*) from public.process_steps where organization_id=target_org and process_id=p.id)
    +(select count(*) from public.process_rules where organization_id=target_org and process_id=p.id)
    +(select count(*) from public.process_exceptions where organization_id=target_org and process_id=p.id)
    or cardinality(active_ids)<>(select count(distinct x) from unnest(active_ids) x) then
    raise exception 'Process contents changed' using errcode='40001'; end if;
  update public.knowledge_chunks set approved=false,health_status='needs_review'
    where organization_id=target_org and process_id=p.id and not(id=any(active_ids));
  update public.process_rules set status='approved',approved_by=auth.uid(),approved_at=stamp
    where organization_id=target_org and process_id=p.id;
  update public.processes set status='approved',approved_by=auth.uid(),approved_at=stamp
    where organization_id=target_org and id=p.id;
  update public.knowledge_proposals q set status='approved',approved_by=auth.uid(),approved_at=stamp,
    approved_knowledge_id=(select c.id from public.knowledge_chunks c where c.organization_id=target_org
      and c.process_id=p.id and c.rule_id=q.process_rule_id and c.approved limit 1)
    where q.organization_id=target_org and q.related_process_id=p.id and q.status in('pending_approval','needs_review');
  update public.notifications set read=true where organization_id=target_org
    and ((entity_type='process' and entity_id=p.id) or (entity_type='knowledge_proposal' and entity_id in(
      select id from public.knowledge_proposals where organization_id=target_org and related_process_id=p.id)));
  insert into public.knowledge_events(organization_id,event_type,actor_id,metadata)
    values(target_org,'knowledge_updated',auth.uid(),jsonb_build_object('process_id',p.id,'knowledge_ids',active_ids,'source_replacement',p.supersedes_process_id));
  return stamp;
end $$;
revoke all on function public.publish_process_knowledge(uuid,uuid,timestamptz,jsonb,jsonb) from public,anon;
grant execute on function public.publish_process_knowledge(uuid,uuid,timestamptz,jsonb,jsonb) to authenticated;
