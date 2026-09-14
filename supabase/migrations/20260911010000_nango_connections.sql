-- Extend the existing connection system. No provider credentials are stored here.
alter table public.integrations add column if not exists last_error_at timestamptz;
alter table public.integrations add column if not exists error_code text;
alter table public.integrations add column if not exists configuration jsonb not null default '{}';

create table public.integration_connect_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  provider text not null,
  integration_key text not null,
  environment text not null,
  connection_id text,
  status text not null default 'pending' check(status in ('pending','confirmed','cancelled','expired')),
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now()
);
create unique index integration_one_pending_attempt on public.integration_connect_attempts(organization_id,provider) where status='pending';
alter table public.integration_connect_attempts enable row level security;
revoke all on public.integration_connect_attempts from public,anon,authenticated;
grant all on public.integration_connect_attempts to service_role;

-- An organization admin cannot forge a Nango ownership reference through PostgREST.
create or replace function public.protect_nango_connection() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role','postgres','supabase_admin') and
     ((tg_op <> 'INSERT' and old.auth_platform = 'nango') or
      (tg_op <> 'DELETE' and new.auth_platform = 'nango')) then
    raise exception 'Nango connections are server managed' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_nango_connection before insert or update or delete on public.integrations
for each row execute function public.protect_nango_connection();

-- Atomic, replay-safe reconciliation. Browser callbacks never invoke this RPC.
create or replace function public.confirm_nango_connection(
  attempt_id uuid, remote_connection_id text, target_status text, event_operation text,
  granted_capabilities text[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.integration_connect_attempts; c public.integrations; result_id uuid;
begin
  select * into a from public.integration_connect_attempts where id=attempt_id;
  if a.id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(a.organization_id::text || ':' || a.provider,0));
  select * into a from public.integration_connect_attempts where id=attempt_id for update;
  select * into c from public.integrations where organization_id=a.organization_id and provider=a.provider for update;
  if a.status in ('cancelled','expired') then return null; end if;
  if a.connection_id is not null and a.connection_id <> remote_connection_id then return null; end if;
  if a.status='pending' then
    if a.expires_at < now() then return null; end if;
    if not exists(select 1 from public.organization_members where organization_id=a.organization_id and user_id=a.user_id and permission_level in ('owner','admin')) then return null; end if;
    if c.id is not null and c.auth_platform is distinct from 'nango' then return null; end if;
  elsif c.external_connection_id is distinct from remote_connection_id or c.auth_platform is distinct from 'nango' then
    return null;
  end if;
  -- Late refresh/creation events must not resurrect a disconnected connection.
  if a.status='confirmed' and c.status='disconnected' then return c.id; end if;
  if target_status not in ('connected','needs_reauthorization','disconnected','error') then raise exception 'Invalid state'; end if;
  insert into public.integrations(organization_id,provider,connection_type,auth_platform,provider_config_key,
    external_connection_id,status,capabilities,connected_by,connected_at,last_error_at,error_code,configuration)
  values(a.organization_id,a.provider,'embedded_oauth','nango',a.integration_key,remote_connection_id,target_status,
    granted_capabilities,a.user_id,now(),case when target_status='needs_reauthorization' then now() end,
    case when target_status='needs_reauthorization' then 'authorization_required' end,jsonb_build_object('environment',a.environment))
  on conflict(organization_id,provider) do update set status=excluded.status, external_connection_id=excluded.external_connection_id,
    connected_at=case when integrations.external_connection_id is distinct from excluded.external_connection_id then excluded.connected_at else integrations.connected_at end,
    connected_by=case when integrations.external_connection_id is distinct from excluded.external_connection_id then excluded.connected_by else integrations.connected_by end,
    provider_config_key=excluded.provider_config_key, capabilities=excluded.capabilities,
    last_error_at=excluded.last_error_at,error_code=excluded.error_code, configuration=excluded.configuration
  returning id into result_id;
  update public.integration_connect_attempts set status='confirmed',connection_id=remote_connection_id where id=a.id;
  if c.id is null or c.status is distinct from target_status then
    insert into public.integration_events(organization_id,integration_id,provider,event_type,actor_id,metadata)
    values(a.organization_id,result_id,a.provider,
      case when target_status='disconnected' then 'integration_disconnected'
      when target_status='connected' then 'integration_connected' else 'integration_connection_failed' end,
      a.user_id,jsonb_build_object('operation',event_operation,'auth_platform','nango'));
  end if;
  return result_id;
end $$;
revoke all on function public.confirm_nango_connection(uuid,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.confirm_nango_connection(uuid,text,text,text,text[]) to service_role;

create or replace function public.begin_nango_connection(target_org uuid, target_user uuid, target_provider text, integration_key text, environment_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare attempt uuid; existing public.integrations;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_org::text || ':' || target_provider,0));
  if not exists(select 1 from public.organization_members where organization_id=target_org and user_id=target_user and permission_level in ('owner','admin')) then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into existing from public.integrations where organization_id=target_org and provider=target_provider;
  if existing.id is not null and existing.auth_platform is distinct from 'nango' then raise exception 'Existing connection must be managed separately'; end if;
  if existing.error_code='disconnect_pending' then raise exception 'Finish disconnecting first'; end if;
  update public.integration_connect_attempts set status='expired' where organization_id=target_org and provider=target_provider and status='pending' and expires_at<=now();
  if exists(select 1 from public.integration_connect_attempts where organization_id=target_org and provider=target_provider and status='pending') then raise exception 'Authorization is already in progress'; end if;
  insert into public.integration_connect_attempts(organization_id,user_id,provider,integration_key,environment,connection_id)
  values(target_org,target_user,target_provider,integration_key,environment_name,case when existing.status<>'disconnected' then existing.external_connection_id end)
  returning id into attempt;
  return attempt;
end $$;
revoke all on function public.begin_nango_connection(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_nango_connection(uuid,uuid,text,text,text) to service_role;

create or replace function public.stop_nango_connection(target_org uuid, target_user uuid, target_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare c public.integrations;
begin
  if not exists(select 1 from public.organization_members where organization_id=target_org and user_id=target_user and permission_level in ('owner','admin')) then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into c from public.integrations where id=target_id and organization_id=target_org and auth_platform='nango';
  if c.id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_org::text || ':' || c.provider,0));
  update public.integrations set status='disconnected',error_code='disconnect_pending' where id=c.id;
  update public.integration_connect_attempts set status='cancelled' where organization_id=target_org and provider=c.provider and status='pending';
  if c.status<>'disconnected' then
    insert into public.integration_events(organization_id,integration_id,provider,event_type,actor_id,metadata)
    values(target_org,c.id,c.provider,'integration_disconnected',target_user,'{"auth_platform":"nango"}');
  end if;
  return true;
end $$;
revoke all on function public.stop_nango_connection(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.stop_nango_connection(uuid,uuid,uuid) to service_role;
