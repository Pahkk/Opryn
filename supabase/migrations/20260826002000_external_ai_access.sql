create table public.external_ai_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique check (agent_id ~ '^agt_[a-zA-Z0-9_-]{12,}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  provider text not null check (provider in ('openai', 'claude', 'voice_agent', 'website_chatbot', 'custom_agent', 'other')),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'active' check (status in ('active', 'paused')),
  knowledge_mode text not null default 'manual' check (knowledge_mode in ('manual', 'all_approved')),
  created_by uuid not null references public.profiles(id),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_ai_connections add constraint external_ai_connections_id_org_unique unique (id, organization_id);

create table public.external_ai_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  key_prefix text not null check (char_length(key_prefix) between 12 and 40),
  key_hash text not null unique check (char_length(key_hash) = 64),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint external_ai_api_keys_connection_org_fkey foreign key (connection_id, organization_id) references public.external_ai_connections(id, organization_id) on delete cascade
);

create table public.external_ai_scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  scope text not null check (scope in ('knowledge:read', 'processes:read', 'policies:read', 'sources:read', 'escalations:create')),
  unique (connection_id, scope),
  constraint external_ai_scopes_connection_org_fkey foreign key (connection_id, organization_id) references public.external_ai_connections(id, organization_id) on delete cascade
);

create table public.external_ai_knowledge_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  source_type text not null check (source_type in ('process_summary', 'process_step', 'rule', 'exception', 'owner_answer', 'role_instruction', 'call_finding', 'faq', 'google_drive', 'video_finding')),
  source_id uuid,
  created_at timestamptz not null default now(),
  constraint external_ai_access_connection_org_fkey foreign key (connection_id, organization_id) references public.external_ai_connections(id, organization_id) on delete cascade
);

create unique index external_ai_access_unique_idx
  on public.external_ai_knowledge_access (connection_id, source_type, coalesce(source_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.external_ai_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  endpoint text not null check (endpoint in ('answer', 'knowledge_search', 'escalations')),
  result_status text not null check (result_status in ('answered', 'unknown', 'created', 'error', 'rate_limited')),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now(),
  constraint external_ai_activity_connection_org_fkey foreign key (connection_id, organization_id) references public.external_ai_connections(id, organization_id) on delete cascade
);

create table public.external_ai_escalations (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^esc_[a-zA-Z0-9_-]{12,}$'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null,
  question text not null check (char_length(question) between 3 and 4000),
  context text not null default '' check (char_length(context) <= 4000),
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  assigned_to uuid references public.profiles(id),
  resolution text check (resolution is null or char_length(resolution) <= 10000),
  proposed_rule text check (proposed_rule is null or char_length(proposed_rule) <= 10000),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_ai_escalations_connection_org_fkey foreign key (connection_id, organization_id) references public.external_ai_connections(id, organization_id) on delete cascade
);

create table public.external_ai_rate_limits (
  key_id uuid not null references public.external_ai_api_keys(id) on delete cascade,
  window_kind text not null check (window_kind in ('minute', 'hour')),
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (key_id, window_kind, window_start)
);

create index external_ai_connections_org_idx on public.external_ai_connections(organization_id, created_at desc);
create index external_ai_keys_connection_idx on public.external_ai_api_keys(connection_id, revoked_at);
create index external_ai_activity_connection_idx on public.external_ai_activity(connection_id, created_at desc);
create index external_ai_escalations_org_idx on public.external_ai_escalations(organization_id, status, created_at desc);
create index external_ai_access_connection_idx on public.external_ai_knowledge_access(connection_id, source_type, source_id);

create trigger external_ai_connections_updated before update on public.external_ai_connections
  for each row execute function public.set_updated_at();
create trigger external_ai_escalations_updated before update on public.external_ai_escalations
  for each row execute function public.set_updated_at();

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

create or replace function public.consume_external_ai_rate_limit(
  target_key_id uuid,
  minute_limit integer default 60,
  hour_limit integer default 1000
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  minute_count integer;
  hour_count integer;
  minute_window timestamptz := date_trunc('minute', now());
  hour_window timestamptz := date_trunc('hour', now());
begin
  delete from public.external_ai_rate_limits where window_start < now() - interval '2 hours';
  insert into public.external_ai_rate_limits (key_id, window_kind, window_start, request_count)
  values (target_key_id, 'minute', minute_window, 1)
  on conflict (key_id, window_kind, window_start) do update
    set request_count = public.external_ai_rate_limits.request_count + 1
  returning request_count into minute_count;
  insert into public.external_ai_rate_limits (key_id, window_kind, window_start, request_count)
  values (target_key_id, 'hour', hour_window, 1)
  on conflict (key_id, window_kind, window_start) do update
    set request_count = public.external_ai_rate_limits.request_count + 1
  returning request_count into hour_count;
  return minute_count <= minute_limit and hour_count <= hour_limit;
end;
$$;

alter table public.external_ai_connections enable row level security;
alter table public.external_ai_api_keys enable row level security;
alter table public.external_ai_scopes enable row level security;
alter table public.external_ai_knowledge_access enable row level security;
alter table public.external_ai_activity enable row level security;
alter table public.external_ai_escalations enable row level security;
alter table public.external_ai_rate_limits enable row level security;

create policy external_ai_connections_admin_read on public.external_ai_connections for select to authenticated
  using (public.is_org_admin(organization_id));
create policy external_ai_connections_admin_insert on public.external_ai_connections for insert to authenticated
  with check (public.is_org_admin(organization_id) and created_by = (select auth.uid()));
create policy external_ai_connections_admin_update on public.external_ai_connections for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy external_ai_connections_admin_delete on public.external_ai_connections for delete to authenticated
  using (public.is_org_admin(organization_id));
create policy external_ai_keys_admin_read on public.external_ai_api_keys for select to authenticated
  using (public.is_org_admin(organization_id));
create policy external_ai_keys_admin_insert on public.external_ai_api_keys for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy external_ai_keys_admin_update on public.external_ai_api_keys for update to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy external_ai_scopes_admin_all on public.external_ai_scopes for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy external_ai_access_admin_all on public.external_ai_knowledge_access for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy external_ai_activity_admin_read on public.external_ai_activity for select to authenticated
  using (public.is_org_admin(organization_id));
create policy external_ai_escalations_admin_all on public.external_ai_escalations for all to authenticated
  using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

grant select, insert, update, delete on public.external_ai_connections to authenticated;
grant select, insert, update on public.external_ai_api_keys to authenticated;
grant select, insert, update, delete on public.external_ai_scopes to authenticated;
grant select, insert, update, delete on public.external_ai_knowledge_access to authenticated;
grant select on public.external_ai_activity to authenticated;
grant select, insert, update, delete on public.external_ai_escalations to authenticated;

revoke all on function public.match_external_ai_knowledge(uuid, uuid, extensions.vector, text[], real, integer) from public, anon, authenticated;
revoke all on function public.consume_external_ai_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.match_external_ai_knowledge(uuid, uuid, extensions.vector, text[], real, integer) to service_role;
grant execute on function public.consume_external_ai_rate_limit(uuid, integer, integer) to service_role;

comment on table public.external_ai_api_keys is 'External agent keys stored as keyed HMAC hashes. Raw keys are displayed once and never persisted.';
comment on function public.match_external_ai_knowledge is 'Service-only retrieval of approved, connection-permitted knowledge for one organization.';
