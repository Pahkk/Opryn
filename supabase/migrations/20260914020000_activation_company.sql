-- Additive. Existing company fields remain canonical; no knowledge is approved here.
alter table public.organizations add column company_profile jsonb not null default '{}'::jsonb
  check (jsonb_typeof(company_profile) = 'object' and octet_length(company_profile::text) <= 12000);
alter table public.organization_onboarding add column activation_process_id uuid references public.processes(id) on delete set null;
-- Preserve legacy descriptions only where the canonical description is empty.
update public.organizations o set description = left(d.business_description, 2000)
from public.organization_discovery d where d.organization_id=o.id and o.description='' and coalesce(d.business_description,'')<>'';

create function public.save_company_profile(workspace_id uuid, expected_revision integer, profile jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare revision integer;
begin
  if not public.is_org_admin(workspace_id) then raise exception 'Owner or admin required' using errcode='42501'; end if;
  if jsonb_typeof(profile)<>'object' or octet_length(profile::text)>12000 or length(trim(coalesce(profile->>'name','')))=0
    or exists(select 1 from jsonb_object_keys(profile) k where k not in ('name','industry','description','employee_count','website','departments','knowledge_areas','notes'))
    then raise exception 'Invalid company profile' using errcode='22023'; end if;
  revision := public.save_workspace_settings(workspace_id, expected_revision,
    jsonb_build_object('name',profile->>'name','industry',profile->>'industry','description',profile->>'description','employee_count',(profile->>'employee_count')::integer));
  update public.organizations set company_profile=profile - array['name','industry','description','employee_count'] where id=workspace_id;
  -- Legacy consumers read a mirror, never an independently editable onboarding answer.
  update public.organization_discovery set business_description=profile->>'description' where organization_id=workspace_id;
  return revision;
end;
$$;
revoke all on function public.save_company_profile(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_company_profile(uuid,integer,jsonb) to authenticated;
