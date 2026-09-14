create or replace function public.is_org_premium_admin(target_org uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_org_admin(target_org) and exists (
    select 1
    from public.organization_subscriptions subscription
    where subscription.organization_id = target_org
      and subscription.plan = 'premium'
      and subscription.status in ('active', 'trialing')
  );
$$;

revoke all on function public.is_org_premium_admin(uuid) from public;
grant execute on function public.is_org_premium_admin(uuid) to authenticated;

drop policy if exists external_ai_connections_admin_insert on public.external_ai_connections;
drop policy if exists external_ai_connections_admin_update on public.external_ai_connections;
create policy external_ai_connections_premium_insert on public.external_ai_connections for insert to authenticated
  with check (
    public.is_org_premium_admin(organization_id)
    and created_by = (select auth.uid())
  );
create policy external_ai_connections_premium_update on public.external_ai_connections for update to authenticated
  using (public.is_org_premium_admin(organization_id))
  with check (public.is_org_premium_admin(organization_id));

drop policy if exists external_ai_keys_admin_insert on public.external_ai_api_keys;
drop policy if exists external_ai_keys_admin_update on public.external_ai_api_keys;
create policy external_ai_keys_premium_insert on public.external_ai_api_keys for insert to authenticated
  with check (public.is_org_premium_admin(organization_id));
create policy external_ai_keys_premium_update on public.external_ai_api_keys for update to authenticated
  using (public.is_org_premium_admin(organization_id))
  with check (public.is_org_premium_admin(organization_id));

drop policy if exists external_ai_scopes_admin_all on public.external_ai_scopes;
create policy external_ai_scopes_premium_all on public.external_ai_scopes for all to authenticated
  using (public.is_org_premium_admin(organization_id))
  with check (public.is_org_premium_admin(organization_id));

drop policy if exists external_ai_access_admin_all on public.external_ai_knowledge_access;
create policy external_ai_access_premium_all on public.external_ai_knowledge_access for all to authenticated
  using (public.is_org_premium_admin(organization_id))
  with check (public.is_org_premium_admin(organization_id));

drop policy if exists external_ai_escalations_admin_all on public.external_ai_escalations;
create policy external_ai_escalations_premium_all on public.external_ai_escalations for all to authenticated
  using (public.is_org_premium_admin(organization_id))
  with check (public.is_org_premium_admin(organization_id));

comment on function public.is_org_premium_admin is 'Defense-in-depth entitlement check for Premium-only organization resources.';
