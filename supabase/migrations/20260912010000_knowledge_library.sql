-- Additive metadata only. No content, status or access policy is rewritten.
do $$ declare t text; begin
  foreach t in array array['processes','knowledge_chunks','knowledge_proposals'] loop
    execute format('alter table public.%I add column library_category text not null default ''uncategorized'' check (library_category in (''policy'',''process'',''faq'',''pricing'',''product_service'',''sales'',''customer_support'',''training'',''responsibility'',''decision'',''exception'',''definition'',''uncategorized'')), add column library_tags text[] not null default ''{}'', add column library_revision integer not null default 1',t);
  end loop;
end $$;

alter table public.processes add column library_archived_at timestamptz;
alter table public.knowledge_chunks add column library_archived_at timestamptz;
alter table public.processes add constraint archived_process_not_approved check (library_archived_at is null or status <> 'approved');
alter table public.knowledge_chunks add constraint archived_knowledge_not_approved check (library_archived_at is null or not approved);

create function public.prepare_library_chunk() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.processes;
begin
  if new.process_id is not null then
    select * into p from public.processes where id=new.process_id and organization_id=new.organization_id;
    if p.library_archived_at is not null and new.approved then raise exception 'Process is archived'; end if;
    if tg_op='INSERT' and new.library_category='uncategorized' then
      new.library_category := coalesce(p.library_category,'uncategorized');
      new.library_tags := coalesce(p.library_tags,'{}');
    end if;
  end if;
  return new;
end $$;
create trigger prepare_library_chunk before insert or update of approved on public.knowledge_chunks
for each row execute function public.prepare_library_chunk();

-- Security-invoker preserves each underlying table's existing role restrictions.
create view public.company_knowledge_library with (security_invoker=true) as
select p.id, p.organization_id, 'process'::text entity, p.title,
  coalesce(p.summary,p.description,'') content,
  p.library_category category, p.library_tags tags, p.library_revision revision,
  case when p.status='approved' then 'approved' when p.status='needs_review' then 'needs_review' else 'observed' end status,
  case when p.source_url like '%google.com/%' then 'Google Workspace' when p.source_provider is not null then p.source_provider when p.learning_source='text' then 'Owner answers' else 'Files' end source,
  p.source_title, p.source_url, p.id process_id, p.updated_at,
  p.approved_at confirmed_at, 0::integer usage_count, 1::integer version, true review_required, false due_for_review
from public.processes p where p.status <> 'rejected' and p.library_archived_at is null
union all
select k.id,k.organization_id,'knowledge',
  left(split_part(k.content,':',1),180),k.content,
  case when k.library_category <> 'uncategorized' then k.library_category when k.source_type='faq' then 'faq' when k.source_type='rule' then 'policy' when k.source_type='role_instruction' then 'responsibility' else 'uncategorized' end,
  k.library_tags,k.library_revision,
  case when k.health_status='conflict' then 'conflict' when k.health_status='needs_review' then 'needs_review' when k.approved then 'approved' else 'observed' end,
  case when p.source_url like '%google.com/%' or k.source_type='google_drive' then 'Google Workspace' when k.source_type like 'call%' then 'Calls' when k.source_type in ('chatgpt','claude','external_ai') then 'AI connections' when p.source_provider is not null then p.source_provider when k.source_type in ('document','video_finding') then 'Files' else 'Owner answers' end,
  coalesce(p.source_title,sp.source_label,p.title),p.source_url,k.process_id,coalesce(k.updated_at,k.created_at),k.last_confirmed_at,
  k.usage_count,k.current_version,true,
  (k.approved and k.health_status <> 'conflict' and (k.health_status='needs_review'
    or k.source_modified_at > coalesce(k.last_confirmed_at,k.created_at)
    or coalesce(k.last_confirmed_at,k.created_at) <= now() - (case when k.criticality='critical' then interval '90 days' else interval '180 days' end)))
from public.knowledge_chunks k left join public.processes p on p.id=k.process_id and p.organization_id=k.organization_id
left join public.knowledge_proposals sp on sp.id=k.source_id and sp.organization_id=k.organization_id
where k.source_type not in ('process_summary','process_step') and k.library_archived_at is null and p.library_archived_at is null
  and not (k.source_type='google_drive' and k.process_id is not null and k.rule_id is null)
union all
select q.id,q.organization_id,'proposal',q.title,q.proposed_content,
  q.library_category,q.library_tags,q.library_revision,'needs_review',coalesce(q.source_label,'Owner answers'),q.source_label,null::text,
  q.related_process_id,q.updated_at,null::timestamptz,0,q.version,
  (q.status='needs_review' or q.existing_knowledge_id is not null),false
from public.knowledge_proposals q where q.status in ('pending_approval','needs_review');
grant select on public.company_knowledge_library to authenticated;

create view public.searchable_company_knowledge with (security_invoker=true) as
select *, title || ' ' || content || ' ' || category || ' ' || array_to_string(tags,' ') || ' ' || coalesce(source_title,'') || ' ' || source as search_text
from public.company_knowledge_library;
grant select on public.searchable_company_knowledge to authenticated;

create function public.knowledge_library_facets(target_organization_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'categories',(select coalesce(jsonb_object_agg(category,n),'{}') from (select category,count(*) n from public.company_knowledge_library where organization_id=target_organization_id group by category) c),
    'sources',(select coalesce(jsonb_agg(source),'[]') from (select distinct source from public.company_knowledge_library where organization_id=target_organization_id order by source) s)
  );
$$;
revoke all on function public.knowledge_library_facets(uuid) from public,anon;
grant execute on function public.knowledge_library_facets(uuid) to authenticated;

-- The existing approval transaction remains authoritative. Carry the reviewer's
-- classification onto its approved entity instead of creating another record.
create function public.copy_approved_library_classification() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='approved' and new.approved_knowledge_id is not null then
    update public.knowledge_chunks set library_category=new.library_category,
      library_tags=new.library_tags,library_revision=library_revision+1
    where id=new.approved_knowledge_id and organization_id=new.organization_id;
  end if;
  return new;
end $$;
create trigger copy_approved_library_classification after update of status on public.knowledge_proposals
for each row when (new.status='approved' and old.status is distinct from new.status)
execute function public.copy_approved_library_classification();

-- Archive is one atomic withdrawal, not a delete. Process-derived knowledge is
-- withdrawn together so a summary cannot keep serving an archived rule.
create function public.archive_library_item(target_organization_id uuid,target_id uuid,target_entity text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.organization_members where organization_id=target_organization_id
    and user_id=auth.uid() and permission_level in ('owner','admin')) then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if target_entity='process' then
    update public.processes set library_archived_at=now(),status='rejected'
      where id=target_id and organization_id=target_organization_id;
    if not found then raise exception 'Not found'; end if;
    update public.knowledge_chunks set approved=false,library_archived_at=now()
      where process_id=target_id and organization_id=target_organization_id;
    update public.process_rules set status='rejected' where process_id=target_id and organization_id=target_organization_id;
    update public.knowledge_proposals set status='rejected',rejected_by=auth.uid(),rejected_at=now(),rejection_reason='Related process archived'
      where related_process_id=target_id and organization_id=target_organization_id and status in ('pending_approval','needs_review');
  elsif target_entity='knowledge' then
    update public.knowledge_chunks set approved=false,library_archived_at=now()
      where id=target_id and organization_id=target_organization_id and process_id is null;
    if not found then raise exception 'Archive the related process instead'; end if;
  else raise exception 'Invalid entity';
  end if;
end $$;
revoke all on function public.archive_library_item(uuid,uuid,text) from public,anon;
grant execute on function public.archive_library_item(uuid,uuid,text) to authenticated;
