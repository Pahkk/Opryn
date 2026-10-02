drop function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean);
create function public.record_external_gap(target_organization_id uuid,target_connection_id uuid,target_key_id uuid,
  question_text text,question_context text,question_embedding extensions.vector(1536),route_question boolean,
  register_occurrence boolean default true, applicability_context jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.external_ai_escalations; cluster uuid; expert uuid; assigned boolean:=false;
begin
  if not public.valid_knowledge_scope(applicability_context) or applicability_context ? 'effectiveFrom' or applicability_context ? 'effectiveUntil' then raise exception 'Invalid applicability context' using errcode='22023'; end if;
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
      and scope_context=applicability_context and context=question_context and created_at>now()-interval '15 minutes' order by created_at desc,id limit 1 for update;
  end if;
  if e.id is null then
    cluster:=public.record_question_cluster(target_organization_id,question_text,question_embedding,'external_ai');
    insert into public.external_ai_escalations(organization_id,connection_id,origin_api_key_id,public_id,question,context,cluster_id,escalated,is_one_time_exception,scope_context)
      values(target_organization_id,target_connection_id,target_key_id,'esc_'||replace(gen_random_uuid()::text,'-',''),
        trim(question_text),question_context,cluster,false,
        (question_text||' '||coalesce(question_context,'')) ~* '(for this (customer|order|case) only|one[- ]time exception|just this once)',applicability_context) returning * into e;
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
revoke all on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) to service_role;
