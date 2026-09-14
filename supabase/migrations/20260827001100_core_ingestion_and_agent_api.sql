alter table public.processes
  add column if not exists learning_source text not null default 'text';

alter table public.processes
  drop constraint if exists processes_learning_source_check;
alter table public.processes
  add constraint processes_learning_source_check
  check (learning_source in ('text', 'voice', 'video', 'screen', 'google_drive'));

alter table public.processes
  add column if not exists source_url text;

drop policy if exists external_ai_connections_premium_insert on public.external_ai_connections;
drop policy if exists external_ai_connections_premium_update on public.external_ai_connections;
drop policy if exists external_ai_keys_premium_insert on public.external_ai_api_keys;
drop policy if exists external_ai_keys_premium_update on public.external_ai_api_keys;
drop policy if exists external_ai_scopes_premium_all on public.external_ai_scopes;
drop policy if exists external_ai_access_premium_all on public.external_ai_knowledge_access;
drop policy if exists external_ai_escalations_premium_all on public.external_ai_escalations;

create policy external_ai_connections_core_insert on public.external_ai_connections
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    and created_by = (select auth.uid())
  );
create policy external_ai_connections_core_update on public.external_ai_connections
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy external_ai_keys_core_insert on public.external_ai_api_keys
  for insert to authenticated with check (public.is_org_admin(organization_id));
create policy external_ai_keys_core_update on public.external_ai_api_keys
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy external_ai_scopes_core_all on public.external_ai_scopes
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy external_ai_access_core_all on public.external_ai_knowledge_access
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy external_ai_escalations_core_all on public.external_ai_escalations
  for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

comment on column public.processes.learning_source is
  'Owner-visible learning input used to create the process.';
comment on column public.processes.source_url is
  'Optional sanitized source link, such as an approved Google Drive share URL.';
