-- Phase 4: additive policies narrow, never bypass existing category/API scopes.
create function public.valid_external_knowledge_policy(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare entry record; value jsonb;
begin
  if jsonb_typeof(p)<>'object' or coalesce(p->>'mode','') not in ('inherit','subjects','items') then return false; end if;
  for entry in select * from jsonb_each(p) loop
    if entry.key='mode' then continue; end if;
    if entry.key not in ('subjects','knowledgeIds','excludedSubjects') or jsonb_typeof(entry.value)<>'array' or jsonb_array_length(entry.value)>200 then return false; end if;
    for value in select * from jsonb_array_elements(entry.value) loop
      if jsonb_typeof(value)<>'string' then return false; end if;
      if entry.key='knowledgeIds' then perform (value#>>'{}')::uuid;
      elsif (value#>>'{}') not in ('policy','process','faq','pricing','product_service','sales','customer_support','training','responsibility','decision','exception','definition','uncategorized') then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end $$;
alter table public.external_ai_connections
  add column knowledge_policy jsonb not null default '{"mode":"inherit"}' check(public.valid_external_knowledge_policy(knowledge_policy)),
  add column unknown_behavior text not null default 'route_expert' check(unknown_behavior in ('route_expert','record_only')),
  add column activity_retention_days integer not null default 90 check(activity_retention_days between 7 and 365);
alter table public.external_ai_activity add column knowledge_versions jsonb not null default '[]' check(jsonb_typeof(knowledge_versions)='array' and jsonb_array_length(knowledge_versions)<=20);
-- New policy fields are writable through the audited, revision-checked RPC only.
revoke update,insert on public.external_ai_connections from public,anon,authenticated;
grant update(name,description,status,knowledge_mode,last_used_at) on public.external_ai_connections to authenticated;
grant insert(agent_id,organization_id,name,provider,description,status,knowledge_mode,created_by) on public.external_ai_connections to authenticated;

create function public.external_policy_allows(policy jsonb,category text,knowledge_id uuid) returns boolean
language sql immutable set search_path='' as $$
  select public.valid_external_knowledge_policy(policy)
    and not(coalesce(policy->'excludedSubjects','[]') ? category)
    and case policy->>'mode'
      when 'inherit' then true
      when 'subjects' then coalesce(policy->'subjects','[]') ? category
      when 'items' then coalesce(policy->'knowledgeIds','[]') ? knowledge_id::text
      else false end;
$$;
create function public.set_external_ai_policy(target_org uuid,target_connection uuid,expected_updated timestamptz,
  policy jsonb,unknown_mode text,retention_days integer) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare c public.external_ai_connections; value jsonb;
begin
  if not coalesce(public.is_org_premium_admin(target_org),false) then raise exception 'Premium administrator required' using errcode='42501'; end if;
  if not public.valid_external_knowledge_policy(policy) or unknown_mode not in ('route_expert','record_only') or retention_days not between 7 and 365 then raise exception 'Invalid policy' using errcode='22023'; end if;
  select * into c from public.external_ai_connections where id=target_connection and organization_id=target_org for update;
  if not found then raise exception 'Connection not found' using errcode='P0002'; end if;
  if c.updated_at is distinct from expected_updated then raise exception 'Connection changed; reload first' using errcode='40001'; end if;
  for value in select * from jsonb_array_elements(coalesce(policy->'knowledgeIds','[]')) loop
    if not exists(select 1 from public.knowledge_chunks where organization_id=target_org and id=(value#>>'{}')::uuid) then raise exception 'Knowledge is outside workspace' using errcode='42501'; end if;
  end loop;
  update public.external_ai_connections set knowledge_policy=policy,unknown_behavior=unknown_mode,activity_retention_days=retention_days
    where id=c.id returning updated_at into c.updated_at;
  insert into public.knowledge_events(organization_id,event_type,actor_id,source_type,source_id,metadata)
    values(target_org,'knowledge_updated',auth.uid(),'external_ai_connection',c.id,jsonb_build_object('action','connection_policy_changed','unknown_behavior',unknown_mode));
  return c.updated_at;
end $$;
revoke all on function public.set_external_ai_policy(uuid,uuid,timestamptz,jsonb,text,integer) from public,anon;
grant execute on function public.set_external_ai_policy(uuid,uuid,timestamptz,jsonb,text,integer) to authenticated;

create or replace function public.match_external_ai_knowledge(target_connection_id uuid,target_organization_id uuid,
 query_embedding extensions.vector(1536),target_source_types text[],match_threshold real default 0.3,match_count integer default 12)
returns table(id uuid,content text,source_type text,source_id uuid,process_id uuid,rule_id uuid,role_id uuid,similarity real)
language sql stable security definer set search_path='' as $$
 select k.id,k.content,k.source_type,k.source_id,k.process_id,k.rule_id,k.role_id,
   (1-(k.embedding operator(extensions.<=>) query_embedding))::real
 from public.knowledge_chunks k join public.external_ai_connections c
   on c.id=target_connection_id and c.organization_id=target_organization_id
 where k.organization_id=target_organization_id and c.status='active' and k.approved and k.library_archived_at is null
   and k.embedding is not null and k.source_type=any(target_source_types)
   and exists(select 1 from public.external_ai_scopes s where s.connection_id=c.id and s.organization_id=c.organization_id and s.scope='knowledge:read')
   and (k.source_type not in ('process_summary','process_step','exception') or exists(select 1 from public.external_ai_scopes s where s.connection_id=c.id and s.organization_id=c.organization_id and s.scope='processes:read'))
   and (k.source_type not in ('rule','owner_answer') or exists(select 1 from public.external_ai_scopes s where s.connection_id=c.id and s.organization_id=c.organization_id and s.scope='policies:read'))
   and (c.knowledge_mode='all_approved' or exists(select 1 from public.external_ai_knowledge_access a where a.connection_id=c.id and a.organization_id=c.organization_id and a.source_type=k.source_type
     and (a.source_id is null or a.source_id in(k.source_id,k.process_id,k.rule_id,k.role_id))))
   and public.external_policy_allows(c.knowledge_policy,k.library_category,k.id)
   and 1-(k.embedding operator(extensions.<=>) query_embedding)>=match_threshold
 order by k.embedding operator(extensions.<=>) query_embedding limit least(greatest(match_count,1),20);
$$;
revoke all on function public.match_external_ai_knowledge(uuid,uuid,extensions.vector,text[],real,integer) from public,anon,authenticated;
grant execute on function public.match_external_ai_knowledge(uuid,uuid,extensions.vector,text[],real,integer) to service_role;

-- Protect unknown routing inside the same service intake used by API/MCP.
alter function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) rename to record_external_gap_before_policy;
revoke all on function public.record_external_gap_before_policy(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) from public,anon,authenticated,service_role;
create function public.record_external_gap(target_organization_id uuid,target_connection_id uuid,target_key_id uuid,
 question_text text,question_context text,question_embedding extensions.vector(1536),route_question boolean,
 register_occurrence boolean default true,applicability_context jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare should_route boolean;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server intake required' using errcode='42501'; end if;
 select unknown_behavior='route_expert' into should_route from public.external_ai_connections
   where organization_id=target_organization_id and id=target_connection_id;
 return public.record_external_gap_before_policy(target_organization_id,target_connection_id,target_key_id,
   question_text,question_context,question_embedding,coalesce(route_question and should_route,false),register_occurrence,applicability_context);
end $$;
revoke all on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.record_external_gap(uuid,uuid,uuid,text,text,extensions.vector,boolean,boolean,jsonb) to service_role;
create function public.prune_external_ai_activity() returns integer
language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 delete from public.external_ai_activity a where a.id in (
   select expired.id from public.external_ai_activity expired join public.external_ai_connections c
     on expired.connection_id=c.id and expired.organization_id=c.organization_id
   where expired.created_at<now()-make_interval(days=>c.activity_retention_days)
   order by expired.created_at limit 5000
 );
 get diagnostics removed=row_count;return removed;
end $$;
revoke all on function public.prune_external_ai_activity() from public,anon,authenticated;
grant execute on function public.prune_external_ai_activity() to service_role;
-- Recheck commit must respect a policy changed while the model was working.
-- Keep the existing canonical verifier, approval/version/scope guards and queue.
create function public.guard_external_gap_policy() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.external_ai_connections;
begin
 if new.status<>'answered' or new.external_escalation_id is null then return new; end if;
 select connection.* into c from public.external_ai_connections connection
   join public.external_ai_escalations e on e.connection_id=connection.id and e.organization_id=connection.organization_id
   where e.id=new.external_escalation_id and e.organization_id=new.organization_id for share of connection;
 if c.id is null or c.status<>'active' or exists(
   select 1 from unnest(new.cited_knowledge_ids) cited left join public.knowledge_chunks k
     on k.id=cited and k.organization_id=new.organization_id
   where k.id is null or not public.external_policy_allows(c.knowledge_policy,k.library_category,k.id)
 ) then raise exception 'Connection policy changed during recheck' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.guard_external_gap_policy() from public,anon,authenticated;
create trigger external_gap_policy before insert or update on public.knowledge_gap_rechecks
 for each row execute function public.guard_external_gap_policy();
