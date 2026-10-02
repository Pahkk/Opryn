-- Extend the existing question loop; no second gap/knowledge store.
alter table public.question_answers
  add column if not exists is_one_time_exception boolean not null default false,
  add column if not exists reusable_intent text not null default 'undecided'
    check (reusable_intent in ('undecided','reusable','answer_only','one_time_exception')),
  add column if not exists knowledge_proposal_id uuid references public.knowledge_proposals(id) on delete set null;

create or replace function public.submit_human_answer(
  target_organization_id uuid, target_question_id uuid, target_answer_id uuid,
  answer_action text, proposal_title text default null, proposal_content text default null,
  one_time_exception boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.employee_questions; a public.question_answers; p public.knowledge_proposals;
  actor uuid := auth.uid(); is_admin boolean; rule_text text; title_text text; hash_text text;
begin
  if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if answer_action not in ('answer_only','request_approval') then
    raise exception 'Invalid answer action' using errcode='22023';
  end if;
  select * into q from public.employee_questions
    where id=target_question_id and organization_id=target_organization_id for update;
  if not found then raise exception 'Question not found' using errcode='P0002'; end if;
  select exists(select 1 from public.organization_members m
    where m.organization_id=target_organization_id and m.user_id=actor
      and m.permission_level in ('owner','admin')) into is_admin;
  if not exists(select 1 from public.organization_members m
    where m.organization_id=target_organization_id and m.user_id=actor)
    or (not is_admin and q.assigned_expert_id is distinct from actor) then
    raise exception 'This question is assigned to another person' using errcode='42501';
  end if;
  select * into a from public.question_answers where id=target_answer_id
    and question_id=q.id and organization_id=target_organization_id for update;
  if not found or a.answer_type not in ('owner','expert') then
    raise exception 'Human answer not found' using errcode='P0002';
  end if;
  if not is_admin and a.answered_by is distinct from actor then
    raise exception 'Cannot submit another person''s answer' using errcode='42501';
  end if;
  -- Idempotent retries cannot change a completed decision's intent.
  if a.reusable_intent <> 'undecided' then
    if (answer_action='request_approval' and a.reusable_intent <> 'reusable')
      or (answer_action='answer_only' and a.reusable_intent='reusable') then
      raise exception 'This answer already has a different disposition' using errcode='40001';
    end if;
    return jsonb_build_object('ok',true,'learned',false,'awaitingApproval',a.knowledge_proposal_id is not null,
      'proposalId',a.knowledge_proposal_id);
  end if;
  if q.status <> 'needs_owner' then
    raise exception 'Question already resolved' using errcode='40001';
  end if;
  if answer_action='request_approval' then
    if one_time_exception or a.is_one_time_exception then
      raise exception 'One-time exceptions cannot become company policy' using errcode='23514';
    end if;
    title_text := nullif(trim(proposal_title),'');
    rule_text := nullif(trim(coalesce(proposal_content,a.proposed_rule)),'');
    if title_text is null or char_length(title_text)>200 or rule_text is null or char_length(rule_text)>10000 then
      raise exception 'Review a title and reusable answer first' using errcode='22023';
    end if;
    -- Include the answer identity: two human decisions retain independent provenance.
    hash_text := encode(sha256(convert_to(target_organization_id::text || ':' || a.id::text,'UTF8')),'hex');
    insert into public.knowledge_proposals(organization_id,proposal_type,title,proposed_content,source_type,
      source_label,source_id,related_question_id,risk_level,status,content_hash,created_by)
    values(target_organization_id,'faq',title_text,rule_text,'owner_answer',
      case when a.answer_type='expert' then 'Expert answer · Team question' else 'Owner answer · Team question' end,
      a.id,q.id,case when (title_text || ' ' || rule_text) ~* '(refund|pricing|safety|legal|contract|compliance|payment|discount|deposit|guarantee)'
        then 'critical' else 'normal' end,'pending_approval',hash_text,a.answered_by) returning * into p;
    update public.question_answers set reusable_intent='reusable',knowledge_proposal_id=p.id,proposed_rule=rule_text where id=a.id;
    insert into public.knowledge_events(organization_id,event_type,actor_id,question_id,source_type,source_id,metadata)
      values(target_organization_id,'proposal_created',actor,q.id,'owner_answer',p.id,
        jsonb_build_object('human_answer_id',a.id,'approval_required',true));
    insert into public.notifications(organization_id,user_id,type,title,body,link,entity_type,entity_id,action,target_url)
      select target_organization_id,m.user_id,'rule_needs_approval',title_text || ' needs approval',
        'A human answer is ready for review. Nothing has been published.',
        '/app/needs-you?item=' || p.id::text,'knowledge_proposal',p.id,'approve','/app/needs-you?item=' || p.id::text
      from public.organization_members m where m.organization_id=target_organization_id and m.permission_level in ('owner','admin');
  else
    update public.question_answers set reusable_intent=case when one_time_exception or a.is_one_time_exception then 'one_time_exception' else 'answer_only' end,
      proposed_rule=null where id=a.id;
  end if;
  -- The interaction is answered; its cluster is NOT resolved by a proposal or one-off answer.
  update public.employee_questions set status='resolved',resolved_at=now() where id=q.id;
  insert into public.notifications(organization_id,user_id,type,title,body,link)
    values(target_organization_id,q.asked_by,'question_answered','Your question was answered',q.question,'/app/ask');
  return jsonb_build_object('ok',true,'learned',false,'awaitingApproval',p.id is not null,'proposalId',p.id);
end; $$;
revoke all on function public.submit_human_answer(uuid,uuid,uuid,text,text,text,boolean) from public,anon;
grant execute on function public.submit_human_answer(uuid,uuid,uuid,text,text,text,boolean) to authenticated;

comment on column public.question_answers.reusable_intent is
  'Explicit human intent; one-time exceptions are interaction data, never approved policy.';
