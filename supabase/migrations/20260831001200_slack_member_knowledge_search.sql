create or replace function public.match_knowledge_for_communication(
  target_organization_id uuid,
  target_user_id uuid,
  query_embedding extensions.vector(1536),
  match_threshold real default 0.72,
  match_count integer default 8
)
returns table (
  id uuid,
  content text,
  source_type text,
  source_id uuid,
  process_id uuid,
  rule_id uuid,
  role_id uuid,
  similarity real
)
language sql
stable
security definer
set search_path = ''
as $$
  with requesting_member as (
    select member.role_id, member.permission_level
    from public.organization_members as member
    where member.organization_id = target_organization_id
      and member.user_id = target_user_id
      and auth.role() = 'service_role'
    limit 1
  )
  select
    knowledge.id,
    knowledge.content,
    knowledge.source_type,
    knowledge.source_id,
    knowledge.process_id,
    knowledge.rule_id,
    knowledge.role_id,
    (1 - (knowledge.embedding operator(extensions.<=>) query_embedding))::real as similarity
  from public.knowledge_chunks as knowledge
  cross join requesting_member as member
  where knowledge.organization_id = target_organization_id
    and knowledge.approved = true
    and knowledge.embedding is not null
    and (
      knowledge.role_id is null
      or knowledge.role_id = member.role_id
      or member.permission_level in ('owner', 'admin')
    )
    and 1 - (knowledge.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by knowledge.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke all on function public.match_knowledge_for_communication(
  uuid,
  uuid,
  extensions.vector,
  real,
  integer
) from public, anon, authenticated;

grant execute on function public.match_knowledge_for_communication(
  uuid,
  uuid,
  extensions.vector,
  real,
  integer
) to service_role;

comment on function public.match_knowledge_for_communication is
  'Returns approved, role-authorized organization knowledge for a verified communication-channel member. Service role only.';
