-- Narrow self-service deletion. External cleanup is deliberately not guessed.
-- No workspace is deleted by applying this migration.
create function public.delete_workspace_safely(workspace_id uuid, confirmation text)
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
  if exists(select 1 from public.organization_subscriptions where organization_id=workspace_id and (stripe_customer_id is not null or stripe_subscription_id is not null)) then
    raise exception 'Billing cleanup required' using errcode='P0003';
  end if;
  if exists(select 1 from public.integrations where organization_id=workspace_id)
    or exists(select 1 from public.integration_connect_attempts where organization_id=workspace_id)
    or exists(select 1 from public.communication_integrations where organization_id=workspace_id)
    or exists(select 1 from public.communication_oauth_states where organization_id=workspace_id)
    or exists(select 1 from public.phone_integrations where organization_id=workspace_id) then
    raise exception 'Connection cleanup required' using errcode='P0004';
  end if;
  if exists(select 1 from storage.objects where split_part(name,'/',1)=workspace_id::text) then
    raise exception 'Stored file cleanup required' using errcode='P0005';
  end if;
  delete from public.organizations where id=workspace_id;
end;
$$;
revoke all on function public.delete_workspace_safely(uuid,text) from public,anon;
grant execute on function public.delete_workspace_safely(uuid,text) to authenticated;
