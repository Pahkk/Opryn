create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  connection_type text not null check (connection_type in (
    'native_oauth','embedded_oauth','mcp','api_key_advanced','manual'
  )),
  auth_platform text,
  provider_config_key text,
  external_connection_id text not null,
  external_account_id text,
  external_account_name text,
  status text not null default 'connected' check (status in (
    'connected','needs_reauthorization','disconnected','error'
  )),
  capabilities text[] not null default '{}'::text[],
  connected_by uuid not null references public.profiles(id),
  connected_at timestamptz,
  last_used_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider),
  unique (auth_platform, provider_config_key, external_connection_id)
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  provider text not null,
  event_type text not null check (event_type in (
    'integration_connection_started','integration_connected',
    'integration_connection_failed','integration_reauthorized',
    'integration_disconnected'
  )),
  actor_id uuid not null references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.integration_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_name text not null,
  use_case text not null,
  follow_up_email text,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'requested' check (status in ('requested','reviewing','planned','closed')),
  created_at timestamptz not null default now()
);

create table public.integration_auth_rate_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (organization_id, user_id)
);

create index integrations_org_status_idx on public.integrations(organization_id, status);
create index integration_events_org_created_idx on public.integration_events(organization_id, created_at desc);
create index integration_requests_org_created_idx on public.integration_requests(organization_id, created_at desc);

create trigger integrations_updated before update on public.integrations
for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;
alter table public.integration_events enable row level security;
alter table public.integration_requests enable row level security;
alter table public.integration_auth_rate_limits enable row level security;

create policy integrations_member_read on public.integrations for select to authenticated
using (public.is_org_member(organization_id));
create policy integrations_admin_insert on public.integrations for insert to authenticated
with check (public.is_org_admin(organization_id) and connected_by = (select auth.uid()));
create policy integrations_admin_update on public.integrations for update to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy integrations_admin_delete on public.integrations for delete to authenticated
using (public.is_org_admin(organization_id));

create policy integration_events_admin_read on public.integration_events for select to authenticated
using (public.is_org_admin(organization_id));
create policy integration_events_admin_insert on public.integration_events for insert to authenticated
with check (public.is_org_admin(organization_id) and actor_id = (select auth.uid()));

create policy integration_requests_admin_read on public.integration_requests for select to authenticated
using (public.is_org_admin(organization_id));
create policy integration_requests_admin_insert on public.integration_requests for insert to authenticated
with check (public.is_org_admin(organization_id) and requested_by = (select auth.uid()));
create policy integration_requests_admin_update on public.integration_requests for update to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

grant select, insert, update, delete on public.integrations to authenticated;
grant select, insert on public.integration_events to authenticated;
grant select, insert, update on public.integration_requests to authenticated;
revoke all on public.integration_auth_rate_limits from anon, authenticated;

create or replace function public.consume_integration_auth_rate_limit(
  target_organization_id uuid
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  current_window timestamptz := date_trunc('minute', now()) -
    make_interval(mins => (extract(minute from now())::integer % 10));
  next_count integer;
begin
  if current_user_id is null or not public.is_org_admin(target_organization_id) then
    return false;
  end if;
  insert into public.integration_auth_rate_limits as limits (
    organization_id, user_id, window_start, request_count
  ) values (target_organization_id, current_user_id, current_window, 1)
  on conflict (organization_id, user_id) do update set
    window_start = case
      when limits.window_start = excluded.window_start then limits.window_start
      else excluded.window_start
    end,
    request_count = case
      when limits.window_start = excluded.window_start then limits.request_count + 1
      else 1
    end
  returning request_count into next_count;
  return next_count <= 10;
end;
$$;

revoke all on function public.consume_integration_auth_rate_limit(uuid) from public, anon;
grant execute on function public.consume_integration_auth_rate_limit(uuid) to authenticated;

comment on table public.integrations is
  'Sanitized organization-scoped connection identities. Provider tokens remain with the auth platform.';
comment on table public.integration_events is
  'Credential-free audit events for connection lifecycle changes.';
comment on table public.integration_requests is
  'Owner requests for providers not configured in Opryn embedded auth.';
