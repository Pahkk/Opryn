-- Additive Phase 3 source observations. Apply only after release approval.
alter table public.integration_sources drop constraint integration_sources_provider_check;
alter table public.integration_sources add constraint integration_sources_provider_check check(provider in('notion','confluence','google_drive'));
alter table public.integration_sources drop constraint integration_sources_source_type_check;
alter table public.integration_sources add constraint integration_sources_source_type_check check(source_type in('page','database','space','file'));
alter table public.processes drop constraint processes_source_provider_check;
alter table public.processes add constraint processes_source_provider_check check(source_provider in('chatgpt','claude','external_ai','notion','confluence','google_drive'));
update public.integrations set capabilities=array_append(capabilities,'sync_source_updates')
  where provider='google_drive' and auth_platform='nango' and not('sync_source_updates'=any(capabilities));
alter table public.integration_sources
  add column approved_process_id uuid references public.processes(id) on delete set null,
  add column normalized_content text,
  add column previous_content text,
  add column last_successful_check_at timestamptz,
  add column review_status text not null default 'pending' check(review_status in('pending','approved','declined')),
  add column import_lease_token uuid,
  add column import_lease_until timestamptz,
  add constraint source_content_size check (
    length(coalesce(normalized_content,'')) <= 100000
    and length(coalesce(previous_content,'')) <= 100000);

-- Walk existing pending revisions back to their most recent approved baseline.
with recursive lineage as (
  select s.id source_id,p.id,p.supersedes_process_id,p.status,0 depth
  from public.integration_sources s join public.processes p
    on p.id=s.process_id and p.organization_id=s.organization_id
  union all
  select l.source_id,p.id,p.supersedes_process_id,p.status,l.depth+1
  from lineage l join public.processes p on p.id=l.supersedes_process_id
  join public.integration_sources s on s.id=l.source_id and s.organization_id=p.organization_id
  where l.depth < 100
), baseline as (
  select distinct on(source_id) source_id,id from lineage
  where status='approved' order by source_id,depth
)
update public.integration_sources s set approved_process_id=b.id
from baseline b where s.id=b.source_id;
update public.integration_sources set review_status='approved' where process_id=approved_process_id;
update public.integration_sources s set review_status='declined'
  from public.processes p where p.organization_id=s.organization_id and p.id=s.process_id and p.status='rejected';

-- Adopt previously imported, explicitly selected Google files without fetching
-- content or changing old knowledge. The first check creates a reviewable import
-- because historical normalized snapshots were not recorded by the old adapter.
insert into public.integration_sources(organization_id,integration_id,provider,external_id,source_type,title,
  process_id,approved_process_id,sync_status,review_status)
select i.organization_id,i.id,'google_drive',f->>'id','file',left(coalesce(nullif(f->>'name',''),p.source_title,p.title),200),
  p.id,case when p.status='approved' then p.id else null end,'imported',
  case when p.status='approved' then 'approved' when p.status='rejected' then 'declined' else 'pending' end
from public.integrations i cross join lateral jsonb_array_elements(
  case when jsonb_typeof(i.configuration->'selected_files')='array' then i.configuration->'selected_files' else '[]' end) f
join public.processes p on p.organization_id=i.organization_id
  and p.id=case when f->>'processId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (f->>'processId')::uuid else null end
  and f->>'id'=any(regexp_split_to_array(p.source_url,'[/?=&]'))
where i.provider='google_drive' and i.auth_platform='nango' and f->>'id' ~ '^[A-Za-z0-9_-]{1,200}$'
on conflict(integration_id,external_id,source_type) do nothing;

create function public.claim_source_import(target_org uuid,target_source uuid,lease_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
  if lease_token is null then raise exception 'Missing lease' using errcode='22023'; end if;
  update public.integration_sources set import_lease_token=lease_token,
    import_lease_until=now()+interval '10 minutes'
  where id=target_source and organization_id=target_org
    and (import_lease_until is null or import_lease_until<now());
  return found;
end $$;
revoke all on function public.claim_source_import(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_source_import(uuid,uuid,uuid) to service_role;

-- Promotion is part of the same transaction that approves the new process.
-- A stale draft cannot displace a newer source observation.
create function public.promote_source_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.integration_sources; prior public.processes;
begin
  if new.status='rejected' then
    update public.integration_sources set review_status='declined',sync_status='imported'
      where organization_id=new.organization_id and process_id=new.id;
    return new;
  end if;
  if new.status <> 'approved' or old.status='approved' then return new; end if;
  select * into s from public.integration_sources
    where organization_id=new.organization_id and process_id=new.id for update;
  if not found then
    if new.source_provider in ('notion','confluence','google_drive') then
      raise exception 'A newer source revision is ready. Review it instead.' using errcode='40001';
    end if;
    return new;
  end if;
  if s.import_lease_until>now() then
    raise exception 'Source import is still running. Try again shortly.' using errcode='40001';
  end if;
  if new.supersedes_process_id is distinct from s.approved_process_id then
    raise exception 'Source baseline changed. Reimport and review the current revision.' using errcode='40001'; end if;
  if s.approved_process_id is not null and s.approved_process_id<>new.id then
    select * into prior from public.processes
      where id=s.approved_process_id and organization_id=new.organization_id for update;
    if not found then raise exception 'Source baseline unavailable' using errcode='40001'; end if;
    -- History is retained, including the previously approved applicability scope.
    insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,title,content,scope,changed_by,change_reason)
    select k.organization_id,k.id,k.current_version,prior.title,k.content,k.scope,new.approved_by,'Source revision replaced after review'
    from public.knowledge_chunks k where k.organization_id=new.organization_id
      and k.process_id=prior.id and k.approved
    on conflict(knowledge_chunk_id,version_number) do nothing;
    update public.knowledge_chunks set approved=false,health_status='needs_review'
      where organization_id=new.organization_id and process_id=prior.id and approved;
    update public.processes set library_archived_at=now()
      where organization_id=new.organization_id and id=prior.id;
  end if;
  update public.integration_sources set approved_process_id=new.id,sync_status='imported',review_status='approved'
    where id=s.id and organization_id=new.organization_id;
  return new;
end $$;
revoke all on function public.promote_source_revision() from public,anon,authenticated;
create trigger promote_source_revision after update of status on public.processes
for each row execute function public.promote_source_revision();

create function public.record_google_source_import(target_org uuid,target_integration uuid,external_file text,imported_process uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only' using errcode='42501'; end if;
  if not exists(select 1 from public.integration_sources where organization_id=target_org and integration_id=target_integration
    and external_id=external_file and process_id=imported_process and provider='google_drive') then raise exception 'Source unavailable'; end if;
  update public.integrations set configuration=jsonb_set(configuration,'{selected_files}',
    (select coalesce(jsonb_agg(case when f->>'id'=external_file then f||jsonb_build_object('processId',imported_process,'importedAt',now()) else f end),'[]')
      from jsonb_array_elements(coalesce(configuration->'selected_files','[]')) f)),last_sync_at=now()
    where organization_id=target_org and id=target_integration and provider='google_drive' and status='connected';
  if not found then raise exception 'Connection changed' using errcode='40001'; end if;
end $$;
revoke all on function public.record_google_source_import(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.record_google_source_import(uuid,uuid,text,uuid) to service_role;
