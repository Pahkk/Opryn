-- Additive Phase 2: scope is applicability, not access permission.
create function public.valid_knowledge_scope(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare pair record; item jsonb;
begin
  if jsonb_typeof(value) <> 'object' then return false; end if;
  for pair in select * from jsonb_each(value) loop
    if pair.key in ('effectiveFrom','effectiveUntil') then
      if jsonb_typeof(pair.value)<>'string' or (pair.value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (pair.value#>>'{}')::date;
    elsif pair.key in ('roles','departments','regions','locations','customerTypes','plans','products','channels') then
      if jsonb_typeof(pair.value)<>'array' or jsonb_array_length(pair.value)>20 then return false; end if;
      for item in select * from jsonb_array_elements(pair.value) loop
        if jsonb_typeof(item)<>'string' or char_length(trim(item#>>'{}')) not between 1 and 120 then return false; end if;
      end loop;
    else return false; end if;
  end loop;
  return not(value ? 'effectiveFrom' and value ? 'effectiveUntil') or value->>'effectiveFrom'<=value->>'effectiveUntil';
exception when others then return false;
end; $$;
alter table public.knowledge_chunks add column scope jsonb not null default '{}' check(public.valid_knowledge_scope(scope));
alter table public.knowledge_versions add column scope jsonb not null default '{}' check(public.valid_knowledge_scope(scope));
alter table public.knowledge_proposals add column scope jsonb not null default '{}' check(public.valid_knowledge_scope(scope));
alter table public.employee_questions add column scope_context jsonb not null default '{}' check(public.valid_knowledge_scope(scope_context) and not(scope_context ? 'effectiveFrom' or scope_context ? 'effectiveUntil'));
alter table public.external_ai_escalations add column scope_context jsonb not null default '{}' check(public.valid_knowledge_scope(scope_context) and not(scope_context ? 'effectiveFrom' or scope_context ? 'effectiveUntil'));

create function public.knowledge_scope_match(value jsonb,context jsonb,at_date date default (now() at time zone 'UTC')::date)
returns text language plpgsql stable set search_path='' as $$
declare dimension text; missing boolean:=false;
begin
  if not public.valid_knowledge_scope(value) or not public.valid_knowledge_scope(context) then return 'outside_scope'; end if;
  if (value ? 'effectiveFrom' and at_date<(value->>'effectiveFrom')::date)
    or (value ? 'effectiveUntil' and at_date>(value->>'effectiveUntil')::date) then return 'outside_scope'; end if;
  foreach dimension in array ARRAY['roles','departments','regions','locations','customerTypes','plans','products','channels'] loop
    if jsonb_array_length(coalesce(value->dimension,'[]'))=0 then continue; end if;
    if jsonb_array_length(coalesce(context->dimension,'[]'))=0 then missing:=true;
    elsif not exists(select 1 from jsonb_array_elements_text(value->dimension) required
      join jsonb_array_elements_text(context->dimension) actual on lower(trim(required))=lower(trim(actual))) then return 'outside_scope'; end if;
  end loop;
  return case when missing then 'needs_clarification' else 'matches' end;
end; $$;

create table public.knowledge_test_cases (
  id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 120),question text not null check(char_length(question) between 3 and 4000),
  context jsonb not null default '{}' check(public.valid_knowledge_scope(context) and not(context ? 'effectiveFrom' or context ? 'effectiveUntil')),
  consumer text not null check(consumer in ('employee','new_hire','connected_ai','support_bot','call_agent')),
  actor_id uuid references public.profiles(id) on delete set null,connection_id uuid references public.external_ai_connections(id) on delete set null,
  expected_outcome text not null check(expected_outcome in ('answered','unknown','conflict','needs_clarification','restricted')),
  expected_knowledge_ids uuid[] not null default '{}',linked_knowledge_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
  last_run_at timestamptz,last_result jsonb,
  check((consumer in ('employee','new_hire') and connection_id is null) or (consumer in ('connected_ai','support_bot','call_agent') and actor_id is null))
);
create index knowledge_test_cases_org on public.knowledge_test_cases(organization_id,created_at desc);
alter table public.knowledge_test_cases enable row level security;
create policy knowledge_tests_admin_read on public.knowledge_test_cases for select to authenticated using(public.is_org_admin(organization_id));
revoke all on public.knowledge_test_cases from anon,authenticated;
grant select on public.knowledge_test_cases to authenticated;
grant all on public.knowledge_test_cases to service_role;

create function public.set_knowledge_proposal_scope(target_org uuid,target_proposal uuid,expected_revision integer,expected_updated timestamptz,value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.knowledge_proposals;
begin
  if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
  if not public.valid_knowledge_scope(value) then raise exception 'Invalid knowledge scope' using errcode='22023'; end if;
  select * into p from public.knowledge_proposals where id=target_proposal and organization_id=target_org for update;
  if not found then raise exception 'Proposal not found' using errcode='P0002'; end if;
  if p.status not in ('pending_approval','needs_review') or p.version<>expected_revision or p.updated_at<>expected_updated then raise exception 'Proposal changed; refresh first' using errcode='40001'; end if;
  update public.knowledge_proposals set scope=value where id=p.id returning * into p;
  return jsonb_build_object('version',p.version,'updatedAt',p.updated_at,'scope',p.scope);
end; $$;
revoke all on function public.set_knowledge_proposal_scope(uuid,uuid,integer,timestamptz,jsonb) from public,anon;
grant execute on function public.set_knowledge_proposal_scope(uuid,uuid,integer,timestamptz,jsonb) to authenticated;

create function public.propose_knowledge_scope(target_org uuid,target_knowledge uuid,expected_revision integer,value jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare k public.knowledge_chunks; proposal uuid;
begin
  if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
  if not public.valid_knowledge_scope(value) then raise exception 'Invalid knowledge scope' using errcode='22023'; end if;
  select * into k from public.knowledge_chunks where id=target_knowledge and organization_id=target_org and approved and library_archived_at is null for update;
  if not found then raise exception 'Approved knowledge not found' using errcode='P0002'; end if;
  if k.current_version<>expected_revision then raise exception 'Knowledge changed; refresh first' using errcode='40001'; end if;
  select id into proposal from public.knowledge_proposals where organization_id=target_org
    and existing_knowledge_id=k.id and source_label='Scope update' and scope=value and status='pending_approval'
    and content_hash=encode(sha256(convert_to(k.id::text||':'||k.current_version::text||':'||value::text,'UTF8')),'hex');
  if found then return proposal; end if;
  insert into public.knowledge_proposals(organization_id,proposal_type,title,proposed_content,source_type,source_label,existing_knowledge_id,risk_level,status,scope,created_by,content_hash)
    values(target_org,'policy',left(split_part(k.content,':',1),120),
      case when strpos(k.content,':')>0 then ltrim(substr(k.content,strpos(k.content,':')+1)) else k.content end,
      'owner_answer','Scope update',k.id,k.criticality,'pending_approval',value,auth.uid(),
      encode(sha256(convert_to(k.id::text||':'||k.current_version::text||':'||value::text,'UTF8')),'hex')) returning id into proposal;
  insert into public.knowledge_events(organization_id,event_type,actor_id,knowledge_chunk_id,source_type,source_id,metadata)
    values(target_org,'proposal_created',auth.uid(),k.id,'owner_answer',proposal,jsonb_build_object('scope_update',true,'previous_version',k.current_version));
  return proposal;
end; $$;
revoke all on function public.propose_knowledge_scope(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.propose_knowledge_scope(uuid,uuid,integer,jsonb) to authenticated;

create function public.require_version_for_scope_change() returns trigger language plpgsql set search_path='' as $$
begin
  if old.approved and new.scope is distinct from old.scope and new.current_version<=old.current_version then
    raise exception 'Scope changes require an approved new version' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger versioned_knowledge_scope before update on public.knowledge_chunks for each row execute function public.require_version_for_scope_change();
