-- Preserve organization-scoped Google file selections when a Nango connection is refreshed.
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
    last_error_at=excluded.last_error_at,error_code=excluded.error_code,
    configuration=coalesce(integrations.configuration,'{}'::jsonb) || jsonb_build_object('environment',a.environment)
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
