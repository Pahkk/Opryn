-- Automatic cleanup is performed by the server after this independent authorization check.
-- Minimal tombstone lets late signed provider callbacks clean up instead of resurrecting access.
create table public.deleted_workspaces (organization_id uuid primary key, deleted_at timestamptz not null default now());
alter table public.deleted_workspaces enable row level security;
revoke all on public.deleted_workspaces from public,anon,authenticated;
grant select on public.deleted_workspaces to service_role;
create function public.authorize_workspace_deletion(workspace_id uuid, confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare workspace_name text; signed_in_at numeric;
begin
  if not exists(select 1 from public.organization_members where organization_id=workspace_id and user_id=auth.uid() and permission_level='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  select name into workspace_name from public.organizations where id=workspace_id for update;
  if workspace_name is null or confirmation is distinct from workspace_name then
    raise exception 'Confirmation mismatch' using errcode='22023';
  end if;
  select max((entry->>'timestamp')::numeric) into signed_in_at
    from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) entry
    where entry->>'method' in ('password','oauth','otp','totp','sso/saml','sso');
  if signed_in_at is null or signed_in_at < extract(epoch from now())-600 or signed_in_at > extract(epoch from now())+60 then
    raise exception 'Recent sign-in required' using errcode='P0002';
  end if;
end;
$$;
revoke all on function public.authorize_workspace_deletion(uuid,text) from public,anon;
grant execute on function public.authorize_workspace_deletion(uuid,text) to authenticated;

create or replace function public.delete_workspace_safely(workspace_id uuid, confirmation text)
returns void language plpgsql security definer set search_path = '' as $$
declare workspace_name text; signed_in_at numeric;
begin
  if not exists(select 1 from public.organization_members where organization_id=workspace_id and user_id=auth.uid() and permission_level='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  select name into workspace_name from public.organizations where id=workspace_id for update;
  if workspace_name is null or confirmation is distinct from workspace_name then
    raise exception 'Confirmation mismatch' using errcode='22023';
  end if;
  select max((entry->>'timestamp')::numeric) into signed_in_at
    from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) entry
    where entry->>'method' in ('password','oauth','otp','totp','sso/saml','sso');
  if signed_in_at is null or signed_in_at < extract(epoch from now())-600 or signed_in_at > extract(epoch from now())+60 then
    raise exception 'Recent sign-in required' using errcode='P0002';
  end if;
  -- Prevent credentials/storage being added between the checks and deletion.
  -- NOWAIT fails safely instead of queuing behind active work.
  lock table public.organization_members, public.organization_subscriptions,
    public.integrations, public.integration_connect_attempts,
    public.communication_integrations, public.communication_oauth_states,
    public.phone_integrations, storage.objects in share row exclusive mode nowait;
  if not exists(select 1 from public.organization_members where organization_id=workspace_id and user_id=auth.uid() and permission_level='owner') then
    raise exception 'Owner required' using errcode='42501';
  end if;
  if exists(select 1 from public.organization_subscriptions where organization_id=workspace_id and stripe_subscription_id is not null and status <> 'canceled') then
    raise exception 'Billing cleanup required' using errcode='P0003';
  end if;
  if exists(select 1 from public.integrations where organization_id=workspace_id and (status <> 'disconnected' or error_code='disconnect_pending'))
    or exists(select 1 from public.integration_connect_attempts where organization_id=workspace_id and status='pending')
    or exists(select 1 from public.communication_integrations where organization_id=workspace_id and (status <> 'disconnected' or encrypted_credentials is not null))
    or exists(select 1 from public.phone_integrations where organization_id=workspace_id and (status <> 'disconnected' or encrypted_credentials <> '')) then
    raise exception 'Connection cleanup required' using errcode='P0004';
  end if;
  if exists(select 1 from storage.objects where split_part(name,'/',1)=workspace_id::text) then
    raise exception 'Stored file cleanup required' using errcode='P0005';
  end if;
  insert into public.deleted_workspaces(organization_id) values(workspace_id);
  delete from public.organizations where id=workspace_id;
end;
$$;

-- Server-only bounded manifest. Delete objects via Storage API, never SQL.
create function public.workspace_deletion_files(workspace_id uuid)
returns table(bucket_id text,name text) language sql security definer set search_path='' as $$
 select o.bucket_id,o.name from storage.objects o where split_part(o.name,'/',1)=workspace_id::text order by o.bucket_id,o.name limit 200;
$$;
revoke all on function public.workspace_deletion_files(uuid) from public,anon,authenticated;
grant execute on function public.workspace_deletion_files(uuid) to service_role;
