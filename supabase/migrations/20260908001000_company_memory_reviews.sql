-- Extend existing trust records; no separate per-channel knowledge store.
create index if not exists knowledge_chunks_freshness_idx
  on public.knowledge_chunks(organization_id, last_confirmed_at) where approved = true;
create index if not exists knowledge_conflicts_open_a_idx
  on public.knowledge_conflicts(organization_id, knowledge_chunk_a) where status = 'open';
create index if not exists knowledge_conflicts_open_b_idx
  on public.knowledge_conflicts(organization_id, knowledge_chunk_b) where status = 'open';

-- An employee may not read the conflicting document. Return only whether the
-- already-authorized answer context is unsafe, never the other document's text.
create or replace function public.knowledge_context_requires_review(target_organization_id uuid, target_chunk_ids uuid[])
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if coalesce(array_length(target_chunk_ids, 1), 0) > 20 then raise exception 'Too many sources'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and exists (
    select 1 from unnest(target_chunk_ids) requested(id)
    where not exists (
      select 1 from public.knowledge_chunks k
      join public.organization_members m on m.organization_id = k.organization_id and m.user_id = auth.uid()
      where k.id = requested.id and k.organization_id = target_organization_id
        and (m.permission_level in ('owner', 'admin') or k.role_id is null or k.role_id = m.role_id)
    )
  ) then return true; end if;
  return exists (
    select 1 from unnest(target_chunk_ids) requested(id)
    where not exists (select 1 from public.knowledge_chunks k where k.id = requested.id
      and k.organization_id = target_organization_id and k.approved
      and k.health_status = 'healthy')
  ) or exists (
    select 1 from public.knowledge_conflicts c where c.organization_id = target_organization_id
      and c.status = 'open' and c.conflict_type = 'conflict'
      and (c.knowledge_chunk_a = any(target_chunk_ids) or c.knowledge_chunk_b = any(target_chunk_ids))
  );
end;
$$;
revoke all on function public.knowledge_context_requires_review(uuid, uuid[]) from public, anon;
grant execute on function public.knowledge_context_requires_review(uuid, uuid[]) to authenticated, service_role;

create or replace function public.limit_company_memory_reviews(target_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_org_admin(target_organization_id) then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text || auth.uid()::text, 0));
  if (select count(*) from public.knowledge_events where organization_id = target_organization_id
      and actor_id = auth.uid() and event_type in ('knowledge_confirmed', 'needs_you_resolved')
      and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Please wait before reviewing more items.' using errcode = '53300';
  end if;
end;
$$;
revoke all on function public.limit_company_memory_reviews(uuid) from public, anon, authenticated, service_role;

-- Confirmation and its audit event are atomic. "Still accurate" must never
-- dismiss a conflict, promote observed content, or confirm a stale browser view.
create or replace function public.confirm_company_knowledge(target_organization_id uuid, target_chunk_id uuid, expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare k public.knowledge_chunks%rowtype;
begin
  if auth.uid() is null or not public.is_org_admin(target_organization_id) then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;
  perform public.limit_company_memory_reviews(target_organization_id);
  select * into k from public.knowledge_chunks where id = target_chunk_id and organization_id = target_organization_id for update;
  if not found then raise exception 'Knowledge not found' using errcode = 'P0002'; end if;
  if not k.approved or k.current_version <> expected_version then
    raise exception 'Knowledge changed. Reload before confirming.' using errcode = '40001';
  end if;
  if k.health_status = 'conflict' or exists (select 1 from public.knowledge_conflicts c
      where c.organization_id = target_organization_id and c.status = 'open' and c.conflict_type = 'conflict'
      and (c.knowledge_chunk_a = k.id or c.knowledge_chunk_b = k.id)) then
    raise exception 'Resolve the conflict before confirming this knowledge.' using errcode = '23514';
  end if;
  update public.knowledge_chunks set last_confirmed_at = now(), health_status = 'healthy' where id = k.id;
  insert into public.knowledge_events(organization_id, event_type, actor_id, knowledge_chunk_id, metadata)
    values (target_organization_id, 'knowledge_confirmed', auth.uid(), k.id, jsonb_build_object('version', k.current_version));
end;
$$;
revoke all on function public.confirm_company_knowledge(uuid, uuid, integer) from public, anon, service_role;
grant execute on function public.confirm_company_knowledge(uuid, uuid, integer) to authenticated;

create or replace function public.resolve_company_knowledge_conflict(target_organization_id uuid, target_conflict_id uuid, decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.knowledge_conflicts%rowtype; retired uuid; k public.knowledge_chunks%rowtype;
begin
  if auth.uid() is null or not public.is_org_admin(target_organization_id) then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;
  if decision not in ('use_first', 'use_second', 'keep_both') then raise exception 'Invalid resolution'; end if;
  perform public.limit_company_memory_reviews(target_organization_id);
  select * into c from public.knowledge_conflicts where id = target_conflict_id and organization_id = target_organization_id for update;
  if not found or c.status <> 'open' then raise exception 'Conflict already reviewed' using errcode = '40001'; end if;
  if decision = 'keep_both' and c.conflict_type = 'conflict' then
    raise exception 'Conflicting policies need a chosen rule or an edited clarification.' using errcode = '23514';
  end if;
  -- Stable lock order prevents two reviewers resolving overlapping pairs in different orders.
  perform 1 from public.knowledge_chunks where organization_id = target_organization_id
    and id in (c.knowledge_chunk_a, c.knowledge_chunk_b) order by id for update;
  if (select count(*) from public.knowledge_chunks where organization_id = target_organization_id
      and id in (c.knowledge_chunk_a, c.knowledge_chunk_b)) <> 2 then raise exception 'Invalid conflict sources'; end if;
  if decision <> 'keep_both' then
    retired := case when decision = 'use_first' then c.knowledge_chunk_b else c.knowledge_chunk_a end;
    select * into k from public.knowledge_chunks where id = retired;
    insert into public.knowledge_versions(organization_id, knowledge_chunk_id, version_number, content, changed_by, change_reason)
      values (target_organization_id, k.id, k.current_version, k.content, auth.uid(), 'Withdrawn during conflict review')
      on conflict (knowledge_chunk_id, version_number) do nothing;
    update public.knowledge_chunks set approved = false, health_status = 'needs_review' where id = retired;
    if k.rule_id is not null then
      update public.process_rules set status = 'draft', approved_by = null, approved_at = null
        where id = k.rule_id and organization_id = target_organization_id;
    end if;
    -- An approved process summary can repeat the retired rule. Require process
    -- review instead of leaving another retrievable copy of that rule active.
    if k.process_id is not null then
      update public.processes set status = 'needs_review' where id = k.process_id and organization_id = target_organization_id;
      update public.knowledge_chunks set approved = false, health_status = 'needs_review'
        where process_id = k.process_id and organization_id = target_organization_id;
    end if;
  end if;
  update public.knowledge_conflicts set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution = decision where id = c.id;
  update public.knowledge_chunks current_chunk set health_status = case when current_chunk.approved then 'healthy' else 'needs_review' end
    where current_chunk.organization_id = target_organization_id and current_chunk.id in (c.knowledge_chunk_a, c.knowledge_chunk_b)
    and not exists (select 1 from public.knowledge_conflicts other where other.organization_id = target_organization_id
      and other.status = 'open' and other.conflict_type = 'conflict' and (other.knowledge_chunk_a = current_chunk.id or other.knowledge_chunk_b = current_chunk.id));
  insert into public.knowledge_events(organization_id, event_type, actor_id, metadata)
    values (target_organization_id, 'needs_you_resolved', auth.uid(), jsonb_build_object('conflict_id', c.id, 'resolution', decision));
end;
$$;
revoke all on function public.resolve_company_knowledge_conflict(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.resolve_company_knowledge_conflict(uuid, uuid, text) to authenticated;

create or replace function public.find_company_knowledge_expert(target_organization_id uuid, question_text text, closest_chunk_id uuid default null)
returns table (user_id uuid, full_name text, assignment_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(question_text) > 8000 then raise exception 'Question too long'; end if;
  return query
    select e.user_id, coalesce(nullif(p.full_name, ''), 'Company expert'), e.id
    from public.knowledge_experts e
    join public.organization_members m on m.organization_id = e.organization_id and m.user_id = e.user_id
    join public.profiles p on p.id = e.user_id
    where e.organization_id = target_organization_id and (
      (e.knowledge_chunk_id = closest_chunk_id and exists (
        select 1 from public.knowledge_chunks k where k.id = closest_chunk_id and k.organization_id = target_organization_id
          and (auth.role() = 'service_role' or public.is_org_admin(target_organization_id) or k.role_id is null
            or exists (select 1 from public.organization_members caller where caller.organization_id = target_organization_id and caller.user_id = auth.uid() and caller.role_id = k.role_id))
      ))
      or (nullif(trim(e.category), '') is not null and not exists (
        select 1 from regexp_split_to_table(lower(trim(e.category)), '[^[:alnum:]]+') word
        where char_length(word) > 2 and not exists (
          select 1 from regexp_split_to_table(lower(question_text), '[^[:alnum:]]+') question_word
          where regexp_replace(question_word, 's$', '') = regexp_replace(word, 's$', '')
        )
      ) and exists (select 1 from regexp_split_to_table(lower(trim(e.category)), '[^[:alnum:]]+') word where char_length(word) > 2))
    )
    order by (e.knowledge_chunk_id = closest_chunk_id) desc nulls last, e.priority, e.id
    limit 1;
end;
$$;
revoke all on function public.find_company_knowledge_expert(uuid, text, uuid) from public, anon;
grant execute on function public.find_company_knowledge_expert(uuid, text, uuid) to authenticated, service_role;
