do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_connections_id_org_unique'
  ) then
    alter table public.external_ai_connections
      add constraint external_ai_connections_id_org_unique unique (id, organization_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_api_keys_connection_org_fkey'
  ) then
    alter table public.external_ai_api_keys
      add constraint external_ai_api_keys_connection_org_fkey
      foreign key (connection_id, organization_id)
      references public.external_ai_connections(id, organization_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_scopes_connection_org_fkey'
  ) then
    alter table public.external_ai_scopes
      add constraint external_ai_scopes_connection_org_fkey
      foreign key (connection_id, organization_id)
      references public.external_ai_connections(id, organization_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_access_connection_org_fkey'
  ) then
    alter table public.external_ai_knowledge_access
      add constraint external_ai_access_connection_org_fkey
      foreign key (connection_id, organization_id)
      references public.external_ai_connections(id, organization_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_activity_connection_org_fkey'
  ) then
    alter table public.external_ai_activity
      add constraint external_ai_activity_connection_org_fkey
      foreign key (connection_id, organization_id)
      references public.external_ai_connections(id, organization_id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'external_ai_escalations_connection_org_fkey'
  ) then
    alter table public.external_ai_escalations
      add constraint external_ai_escalations_connection_org_fkey
      foreign key (connection_id, organization_id)
      references public.external_ai_connections(id, organization_id) on delete cascade;
  end if;
end $$;

drop function if exists public.match_external_ai_knowledge(uuid, uuid, extensions.vector, real, integer);

create or replace function public.match_external_ai_knowledge(
  target_connection_id uuid,
  target_organization_id uuid,
  query_embedding extensions.vector(1536),
  target_source_types text[],
  match_threshold real default 0.3,
  match_count integer default 12
)
returns table (
  id uuid, content text, source_type text, source_id uuid, process_id uuid,
  rule_id uuid, role_id uuid, similarity real
)
language sql stable security definer set search_path = '' as $$
  select k.id, k.content, k.source_type, k.source_id, k.process_id, k.rule_id, k.role_id,
    (1 - (k.embedding operator(extensions.<=>) query_embedding))::real as similarity
  from public.knowledge_chunks k
  join public.external_ai_connections c
    on c.id = target_connection_id and c.organization_id = target_organization_id
  where k.organization_id = target_organization_id
    and c.status = 'active'
    and k.approved = true
    and k.embedding is not null
    and k.source_type = any(target_source_types)
    and (
      c.knowledge_mode = 'all_approved'
      or exists (
        select 1 from public.external_ai_knowledge_access a
        where a.connection_id = c.id
          and a.organization_id = c.organization_id
          and a.source_type = k.source_type
          and (a.source_id is null or a.source_id = k.source_id or a.source_id = k.process_id or a.source_id = k.rule_id or a.source_id = k.role_id)
      )
    )
    and 1 - (k.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by k.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_external_ai_knowledge(uuid, uuid, extensions.vector, text[], real, integer) from public, anon, authenticated;
grant execute on function public.match_external_ai_knowledge(uuid, uuid, extensions.vector, text[], real, integer) to service_role;
