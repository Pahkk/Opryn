create table public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique check (client_id ~ '^mcp_client_[A-Za-z0-9_-]{16,}$'),
  client_name text not null check (char_length(client_name) between 1 and 160),
  redirect_uris jsonb not null check (jsonb_typeof(redirect_uris) = 'array'),
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  response_types jsonb not null default '["code"]'::jsonb,
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method = 'none'),
  software_id text,
  client_uri text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.mcp_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.mcp_oauth_clients(id) on delete cascade,
  client_kind text not null default 'custom_mcp' check (client_kind in ('chatgpt','claude','custom_mcp')),
  scopes text[] not null,
  resource text not null,
  authorized_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (organization_id, user_id, client_id, resource)
);

create table public.mcp_oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.mcp_oauth_grants(id) on delete cascade,
  code_hash text not null unique check (char_length(code_hash) = 64),
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  scopes text[] not null,
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.mcp_oauth_grants(id) on delete cascade,
  access_token_hash text not null unique check (char_length(access_token_hash) = 64),
  refresh_token_hash text not null unique check (char_length(refresh_token_hash) = 64),
  scopes text[] not null,
  resource text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by uuid references public.mcp_oauth_tokens(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table public.mcp_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  grant_id uuid not null references public.mcp_oauth_grants(id) on delete cascade,
  client_kind text not null check (client_kind in ('chatgpt','claude','custom_mcp')),
  tool_name text not null check (tool_name in ('ask_opryn','search_company_knowledge','check_company_policy','get_company_process','request_owner_guidance')),
  result_status text not null check (result_status in ('answered','unknown','submitted','not_found','forbidden','error','rate_limited')),
  source_count integer not null default 0 check (source_count >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.mcp_rate_limits (
  grant_id uuid primary key references public.mcp_oauth_grants(id) on delete cascade,
  minute_window timestamptz not null,
  minute_count integer not null default 0,
  hour_window timestamptz not null,
  hour_count integer not null default 0
);

create index mcp_grants_org_idx on public.mcp_oauth_grants(organization_id, authorized_at desc);
create index mcp_grants_user_idx on public.mcp_oauth_grants(user_id, revoked_at);
create index mcp_codes_expiry_idx on public.mcp_oauth_authorization_codes(expires_at) where used_at is null;
create index mcp_tokens_grant_idx on public.mcp_oauth_tokens(grant_id, revoked_at, access_expires_at);
create index mcp_activity_org_idx on public.mcp_activity(organization_id, created_at desc);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_grants enable row level security;
alter table public.mcp_oauth_authorization_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
alter table public.mcp_activity enable row level security;
alter table public.mcp_rate_limits enable row level security;

create policy mcp_grants_member_read on public.mcp_oauth_grants for select to authenticated
using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));
create policy mcp_clients_authorized_read on public.mcp_oauth_clients for select to authenticated
using (exists (
  select 1 from public.mcp_oauth_grants as grant_row
  where grant_row.client_id = mcp_oauth_clients.id
    and (grant_row.user_id = (select auth.uid()) or public.is_org_admin(grant_row.organization_id))
));
create policy mcp_activity_member_read on public.mcp_activity for select to authenticated
using (user_id = (select auth.uid()) or public.is_org_admin(organization_id));

grant select on public.mcp_oauth_grants to authenticated;
grant select on public.mcp_oauth_clients to authenticated;
grant select on public.mcp_activity to authenticated;
revoke all on public.mcp_oauth_clients from anon;
revoke all on public.mcp_oauth_authorization_codes from anon, authenticated;
revoke all on public.mcp_oauth_tokens from anon, authenticated;
revoke all on public.mcp_rate_limits from anon, authenticated;

create or replace function public.consume_mcp_rate_limit(
  target_grant_id uuid,
  minute_limit integer default 30,
  hour_limit integer default 500
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  now_value timestamptz := now();
  minute_start timestamptz := date_trunc('minute', now_value);
  hour_start timestamptz := date_trunc('hour', now_value);
  current_row public.mcp_rate_limits;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  insert into public.mcp_rate_limits as limits (
    grant_id, minute_window, minute_count, hour_window, hour_count
  ) values (target_grant_id, minute_start, 1, hour_start, 1)
  on conflict (grant_id) do update set
    minute_count = case when limits.minute_window = minute_start then limits.minute_count + 1 else 1 end,
    minute_window = minute_start,
    hour_count = case when limits.hour_window = hour_start then limits.hour_count + 1 else 1 end,
    hour_window = hour_start
  returning * into current_row;
  return current_row.minute_count <= minute_limit and current_row.hour_count <= hour_limit;
end;
$$;

revoke all on function public.consume_mcp_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_mcp_rate_limit(uuid, integer, integer) to service_role;

alter table public.employee_questions drop constraint if exists employee_questions_origin_check;
alter table public.employee_questions add constraint employee_questions_origin_check
  check (origin in ('employee','external_ai','slack','teams','mcp_chatgpt','mcp_claude','mcp_custom'));

create or replace function public.record_question_cluster(
  target_organization_id uuid,
  question_text text,
  question_embedding extensions.vector(1536),
  question_origin text default 'employee'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare matched_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized';
  end if;
  if question_origin not in ('employee','external_ai','slack','teams','mcp_chatgpt','mcp_claude','mcp_custom') then
    raise exception 'Invalid question origin';
  end if;
  select cluster.id into matched_id
  from public.question_clusters cluster
  where cluster.organization_id = target_organization_id
    and cluster.status = 'open'
    and cluster.embedding is not null
    and 1 - (cluster.embedding operator(extensions.<=>) question_embedding) >= 0.84
  order by cluster.embedding operator(extensions.<=>) question_embedding
  limit 1;
  if matched_id is null then
    insert into public.question_clusters (
      organization_id, topic, representative_question, embedding, employee_count, agent_count
    ) values (
      target_organization_id, left(trim(question_text), 240), trim(question_text), question_embedding,
      case when question_origin in ('employee','slack','teams') then 1 else 0 end,
      case when question_origin in ('external_ai','mcp_chatgpt','mcp_claude','mcp_custom') then 1 else 0 end
    ) returning id into matched_id;
  else
    update public.question_clusters
    set question_count = question_count + 1,
        employee_count = employee_count + case when question_origin in ('employee','slack','teams') then 1 else 0 end,
        agent_count = agent_count + case when question_origin in ('external_ai','mcp_chatgpt','mcp_claude','mcp_custom') then 1 else 0 end
    where id = matched_id;
  end if;
  return matched_id;
end;
$$;

comment on table public.mcp_oauth_tokens is 'Opaque MCP OAuth access and refresh tokens. Only keyed hashes are persisted.';
comment on table public.mcp_activity is 'Minimal MCP audit events without raw access tokens or complete private conversations.';
