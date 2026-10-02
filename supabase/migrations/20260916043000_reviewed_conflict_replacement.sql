-- Explicit human-reviewed replacement, through the existing proposal decision RPC.
create function public.replace_company_knowledge_conflict(target_org uuid,target_conflict uuid,
  expected_first_version integer,expected_second_version integer,new_title text,new_content text,
  prepared_embedding extensions.vector(1536)) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.knowledge_conflicts; a public.knowledge_chunks; p public.knowledge_proposals; result jsonb;
begin
  if auth.uid() is null or not public.is_org_admin(target_org) then raise exception 'Owner/admin required' using errcode='42501'; end if;
  if char_length(trim(new_title)) not between 1 and 160 or char_length(trim(new_content)) not between 20 and 12000
    or prepared_embedding is null then raise exception 'Review the updated guidance' using errcode='22023'; end if;
  -- Same pair/version locks and snapshots as choosing either source. All of this
  -- is rolled back if canonical publication rejects the replacement.
  perform public.resolve_company_knowledge_conflict(target_org,target_conflict,'use_first',expected_first_version,expected_second_version);
  select * into c from public.knowledge_conflicts where organization_id=target_org and id=target_conflict;
  select * into a from public.knowledge_chunks where organization_id=target_org and id=c.knowledge_chunk_a;
  update public.knowledge_chunks set approved=false,health_status='needs_review' where organization_id=target_org
    and (id=a.id or (a.process_id is not null and process_id=a.process_id));
  if a.process_id is not null then update public.processes set status='needs_review' where organization_id=target_org and id=a.process_id; end if;
  insert into public.knowledge_proposals(organization_id,proposal_type,title,proposed_content,source_type,source_label,source_id,
    risk_level,status,content_hash,created_by,scope)
    values(target_org,'rule',trim(new_title),trim(new_content),'owner_answer','Human-reviewed conflict decision',target_conflict,
      'critical','pending_approval',md5(target_conflict::text||new_title||new_content)||md5(a.scope::text),auth.uid(),a.scope) returning * into p;
  result=public.decide_knowledge_proposal(target_org,p.id,auth.uid(),p.version,p.updated_at,'approved','web',prepared_embedding,null,null);
  -- Preserve the first answer's access boundary, separately from applicability.
  update public.knowledge_chunks set role_id=a.role_id where organization_id=target_org and id=(result->>'knowledgeId')::uuid;
  update public.knowledge_conflicts set resolution='updated_rule' where organization_id=target_org and id=c.id;
  insert into public.knowledge_events(organization_id,event_type,actor_id,metadata) values(target_org,'needs_you_resolved',auth.uid(),
    jsonb_build_object('conflict_id',c.id,'resolution','updated_rule','previous_knowledge_ids',jsonb_build_array(c.knowledge_chunk_a,c.knowledge_chunk_b),
      'proposal_id',p.id,'replacement_knowledge_id',result->>'knowledgeId'));
  return result;
end $$;
revoke all on function public.replace_company_knowledge_conflict(uuid,uuid,integer,integer,text,text,extensions.vector) from public,anon,service_role;
grant execute on function public.replace_company_knowledge_conflict(uuid,uuid,integer,integer,text,text,extensions.vector) to authenticated;
