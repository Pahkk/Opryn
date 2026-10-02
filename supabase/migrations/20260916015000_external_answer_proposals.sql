-- External interactions retain their real identity; reuse the canonical proposal store.
alter table public.external_ai_escalations
  add column if not exists is_one_time_exception boolean not null default false,
  add column if not exists reusable_intent text not null default 'undecided'
    check (reusable_intent in ('undecided','reusable','answer_only','one_time_exception','dismissed')),
  add column if not exists knowledge_proposal_id uuid references public.knowledge_proposals(id) on delete set null;

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
      and m.permission_level in ('owner','admin')) then
    raise exception 'Workspace administrator required' using errcode='42501';
  end if;
  if answer_action not in ('request_approval','answer_only','dismiss') then
    raise exception 'Invalid answer action' using errcode='22023';
  end if;
  select * into e from public.external_ai_escalations where id=target_escalation_id
    and connection_id=target_connection_id and organization_id=target_organization_id for update;
  if not found then raise exception 'Escalation not found' using errcode='P0002'; end if;
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
