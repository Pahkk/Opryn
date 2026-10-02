alter table public.external_ai_escalations add column escalated boolean not null default true;
create policy external_escalation_assigned_read on public.external_ai_escalations for select to authenticated
  using(public.is_org_member(organization_id) and assigned_to=auth.uid());

create function public.record_external_gap(target_organization_id uuid,target_connection_id uuid,target_key_id uuid,
  question_text text,question_context text,question_embedding extensions.vector(1536),route_question boolean,
  register_occurrence boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.external_ai_escalations; cluster uuid; expert uuid; assigned boolean:=false;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server intake required' using errcode='42501'; end if;
  if char_length(trim(question_text)) not between 3 and 4000 or char_length(question_context)>4000 then raise exception 'Invalid question'; end if;
  if not exists(select 1 from public.external_ai_connections c join public.external_ai_api_keys a
    on a.connection_id=c.id and a.organization_id=c.organization_id where c.id=target_connection_id
      and c.organization_id=target_organization_id and c.status='active' and a.id=target_key_id and a.revoked_at is null) then
    raise exception 'Connection access changed' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text||':gap-cluster',0));
  if route_question then
    if not exists(select 1 from public.external_ai_scopes s where s.connection_id=target_connection_id
      and s.organization_id=target_organization_id and s.scope='escalations:create') then
      raise exception 'Escalation scope required' using errcode='42501';
    end if;
    assigned:=not exists(select 1 from public.organization_settings s where s.organization_id=target_organization_id and s.allow_escalations=false);
  end if;
  -- Explicit escalation attaches to the caller's latest matching unknown rather than double-counting it.
  if not register_occurrence then
    select * into e from public.external_ai_escalations where organization_id=target_organization_id
      and connection_id=target_connection_id and origin_api_key_id=target_key_id and status='open'
      and lower(regexp_replace(trim(question),'[[:space:]]+',' ','g'))=lower(regexp_replace(trim(question_text),'[[:space:]]+',' ','g'))
      and context=question_context and created_at>now()-interval '15 minutes' order by created_at desc,id limit 1 for update;
  end if;
  if e.id is null then
    cluster:=public.record_question_cluster(target_organization_id,question_text,question_embedding,'external_ai');
    insert into public.external_ai_escalations(organization_id,connection_id,origin_api_key_id,public_id,question,context,cluster_id,escalated,is_one_time_exception)
      values(target_organization_id,target_connection_id,target_key_id,'esc_'||replace(gen_random_uuid()::text,'-',''),
        trim(question_text),question_context,cluster,false,
        (question_text||' '||coalesce(question_context,'')) ~* '(for this (customer|order|case) only|one[- ]time exception|just this once)') returning * into e;
  end if;
  if assigned and not e.escalated then
    select user_id into expert from public.find_company_knowledge_expert(target_organization_id,question_text,null);
    if expert is null then select user_id into expert from public.organization_members
      where organization_id=target_organization_id and permission_level in ('owner','admin') order by (permission_level='owner') desc,user_id limit 1; end if;
    update public.external_ai_escalations set assigned_to=expert,escalated=true where id=e.id;
    if expert is not null and not exists(select 1 from public.notifications n join public.external_ai_escalations previous
      on previous.id=n.entity_id and previous.organization_id=n.organization_id
      where n.organization_id=target_organization_id and n.user_id=expert and n.entity_type='external_ai_escalation'
        and not n.read and n.created_at>now()-interval '24 hours' and previous.cluster_id=e.cluster_id and previous.status='open') then
      insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
        values(target_organization_id,expert,'external_ai_escalation','Connected AI needs an answer',question_text,
          '/app/needs-you?item=external-question-'||e.id::text,'external_ai_escalation',e.id,'answer',
          '/app/needs-you?item=external-question-'||e.id::text);
    end if;
  end if;
  return jsonb_build_object('id',e.id,'publicId',e.public_id,'clusterId',e.cluster_id,'routed',assigned or e.escalated);
end; $$;
revoke all on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean) from public,anon,authenticated;
grant execute on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean) to service_role;

-- Assigned experts may answer; publishing still goes through the canonical pending proposal.
create or replace function public.submit_external_human_answer(
  target_organization_id uuid, target_connection_id uuid, target_escalation_id uuid,
  answer_action text, answer_text text default '', proposal_content text default '',
  one_time_exception boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.external_ai_escalations; p public.knowledge_proposals;
  actor uuid := auth.uid(); rule_text text; title_text text;
begin
  if actor is null or not exists(select 1 from public.organization_members m
    where m.organization_id=target_organization_id and m.user_id=actor
       ) then
    raise exception 'Workspace access required' using errcode='42501';
  end if;
  if answer_action not in ('request_approval','answer_only','dismiss','save_draft') then
    raise exception 'Invalid answer action' using errcode='22023';
  end if;
  select * into e from public.external_ai_escalations where id=target_escalation_id
    and connection_id=target_connection_id and organization_id=target_organization_id for update;
  if not found then raise exception 'Escalation not found' using errcode='P0002'; end if;
  if e.assigned_to is distinct from actor and not public.is_org_admin(target_organization_id) then
    raise exception 'This question is assigned to another person' using errcode='42501';
  end if;
  if answer_action='save_draft' then
    if e.status <> 'open' or e.reusable_intent <> 'undecided' then raise exception 'Escalation already resolved' using errcode='40001'; end if;
    if e.is_one_time_exception or one_time_exception then raise exception 'One-time exceptions cannot become company policy' using errcode='23514'; end if;
    if nullif(trim(answer_text),'') is null or char_length(answer_text)>10000 or char_length(proposal_content)>10000 then raise exception 'Invalid answer draft' using errcode='22023'; end if;
    update public.external_ai_escalations set resolution=trim(answer_text),proposed_rule=proposal_content where id=e.id;
    return jsonb_build_object('ok',true);
  end if;
  if e.reusable_intent <> 'undecided' then
    if (answer_action='request_approval' and e.reusable_intent <> 'reusable')
      or (answer_action='answer_only' and e.reusable_intent not in ('answer_only','one_time_exception'))
      or (answer_action='dismiss' and e.reusable_intent <> 'dismissed') then
      raise exception 'This answer already has a different disposition' using errcode='40001';
    end if;
    return jsonb_build_object('ok',true,'learned',false,'awaitingApproval',e.knowledge_proposal_id is not null,
      'proposalId',e.knowledge_proposal_id);
  end if;
  if e.status <> 'open' then raise exception 'Escalation already resolved' using errcode='40001'; end if;
  if answer_action <> 'dismiss' and (nullif(trim(answer_text),'') is null or char_length(answer_text)>10000) then
    raise exception 'Write an answer first' using errcode='22023';
  end if;
  if answer_action='request_approval' then
    if one_time_exception or e.is_one_time_exception then
      raise exception 'One-time exceptions cannot become company policy' using errcode='23514';
    end if;
    rule_text := nullif(trim(coalesce(nullif(proposal_content,''),e.proposed_rule)),'');
    if rule_text is null or char_length(rule_text)>10000 then
      raise exception 'Review a reusable answer first' using errcode='22023';
    end if;
    title_text := left(e.question,120);
    insert into public.knowledge_proposals(organization_id,proposal_type,title,proposed_content,source_type,
      source_label,source_id,risk_level,status,content_hash,created_by)
    values(target_organization_id,'faq',title_text,rule_text,'owner_answer','Human answer · AI connection',
      e.id,case when (title_text || ' ' || rule_text) ~* '(refund|pricing|safety|legal|contract|compliance|payment|discount|deposit|guarantee)'
        then 'critical' else 'normal' end,'pending_approval',
      encode(sha256(convert_to(target_organization_id::text || ':external:' || e.id::text,'UTF8')),'hex'),actor)
      returning * into p;
    insert into public.knowledge_events(organization_id,event_type,actor_id,source_type,source_id,metadata)
      values(target_organization_id,'proposal_created',actor,'owner_answer',p.id,
        jsonb_build_object('external_escalation_id',e.id,'connection_id',e.connection_id,'approval_required',true));
    insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
      select target_organization_id,m.user_id,'rule_needs_approval',title_text || ' needs approval',
        'A human answer is ready for review. Nothing has been published.',
        '/app/needs-you?item=' || p.id::text,'knowledge_proposal',p.id,'approve','/app/needs-you?item=' || p.id::text
      from public.organization_members m where m.organization_id=target_organization_id and m.permission_level in ('owner','admin');
  end if;
  update public.external_ai_escalations set resolution=case when answer_action='dismiss' then resolution else trim(answer_text) end,
    proposed_rule=case when answer_action='request_approval' then rule_text else null end,
    reusable_intent=case when answer_action='request_approval' then 'reusable' when answer_action='dismiss' then 'dismissed'
      when one_time_exception or e.is_one_time_exception then 'one_time_exception' else 'answer_only' end,
    is_one_time_exception=one_time_exception or e.is_one_time_exception,
    knowledge_proposal_id=p.id,status=case when answer_action='dismiss' then 'dismissed' else 'answered' end,
    resolved_at=now() where id=e.id;
  -- An answered interaction is not proof that approved knowledge now answers its cluster.
  return jsonb_build_object('ok',true,'learned',false,'awaitingApproval',p.id is not null,'proposalId',p.id);
end; $$;
revoke all on function public.submit_external_human_answer(uuid,uuid,uuid,text,text,text,boolean) from public,anon;
grant execute on function public.submit_external_human_answer(uuid,uuid,uuid,text,text,text,boolean) to authenticated;
