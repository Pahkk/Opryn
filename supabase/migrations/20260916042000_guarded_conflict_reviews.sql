create function public.knowledge_scopes_overlap(a jsonb,b jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare dimension text;
begin
  if not public.valid_knowledge_scope(a) or not public.valid_knowledge_scope(b) then return true; end if;
  if a->>'effectiveUntil'<b->>'effectiveFrom' or b->>'effectiveUntil'<a->>'effectiveFrom' then return false; end if;
  foreach dimension in array array['roles','departments','regions','locations','customerTypes','plans','products','channels'] loop
    if jsonb_array_length(coalesce(a->dimension,'[]'))>0 and jsonb_array_length(coalesce(b->dimension,'[]'))>0
      and not exists(select 1 from jsonb_array_elements_text(a->dimension) x
        join jsonb_array_elements_text(b->dimension) y on lower(trim(x.value))=lower(trim(y.value))) then return false; end if;
  end loop;
  return true;
end $$;

alter function public.resolve_company_knowledge_conflict(uuid,uuid,text)
  rename to resolve_company_knowledge_conflict_unchecked;
revoke all on function public.resolve_company_knowledge_conflict_unchecked(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.resolve_company_knowledge_conflict(target_organization_id uuid,target_conflict_id uuid,
  decision text,expected_first_version integer,expected_second_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare c public.knowledge_conflicts; a public.knowledge_chunks; b public.knowledge_chunks;
begin
  if auth.uid() is null or not public.is_org_admin(target_organization_id) then raise exception 'Owner/admin required' using errcode='42501'; end if;
  select * into c from public.knowledge_conflicts where organization_id=target_organization_id and id=target_conflict_id for update;
  if not found or c.status<>'open' then raise exception 'Conflict already reviewed' using errcode='40001'; end if;
  perform 1 from public.knowledge_chunks where organization_id=target_organization_id
    and id in(c.knowledge_chunk_a,c.knowledge_chunk_b) order by id for update;
  select * into a from public.knowledge_chunks where organization_id=target_organization_id and id=c.knowledge_chunk_a;
  select * into b from public.knowledge_chunks where organization_id=target_organization_id and id=c.knowledge_chunk_b;
  if a.id is null or b.id is null or not a.approved or not b.approved
    or a.current_version is distinct from expected_first_version or b.current_version is distinct from expected_second_version then
    raise exception 'Guidance changed. Reopen this review.' using errcode='40001'; end if;
  -- The old resolver's omitted scope cannot corrupt new version history.
  insert into public.knowledge_versions(organization_id,knowledge_chunk_id,version_number,content,scope,changed_by,change_reason)
    values(target_organization_id,a.id,a.current_version,a.content,a.scope,auth.uid(),'Conflict review snapshot'),
      (target_organization_id,b.id,b.current_version,b.content,b.scope,auth.uid(),'Conflict review snapshot')
    on conflict(knowledge_chunk_id,version_number) do nothing;
  if decision='keep_scoped' then
    if public.knowledge_scopes_overlap(a.scope,b.scope) then raise exception 'Scopes still overlap' using errcode='23514'; end if;
    perform public.limit_company_memory_reviews(target_organization_id);
    update public.knowledge_conflicts set status='resolved',resolution='keep_scoped',resolved_by=auth.uid(),resolved_at=now()
      where id=c.id and organization_id=target_organization_id;
    update public.knowledge_chunks k set health_status='healthy' where organization_id=target_organization_id and id in(a.id,b.id)
      and not exists(select 1 from public.knowledge_conflicts f where f.organization_id=target_organization_id and f.status='open'
        and f.conflict_type='conflict' and k.id in(f.knowledge_chunk_a,f.knowledge_chunk_b));
    insert into public.knowledge_events(organization_id,event_type,actor_id,metadata) values(target_organization_id,'needs_you_resolved',auth.uid(),
      jsonb_build_object('conflict_id',c.id,'resolution','keep_scoped','first_version',a.current_version,'second_version',b.current_version));
  else
    perform public.resolve_company_knowledge_conflict_unchecked(target_organization_id,target_conflict_id,decision);
  end if;
end $$;
revoke all on function public.resolve_company_knowledge_conflict(uuid,uuid,text,integer,integer) from public,anon,service_role;
grant execute on function public.resolve_company_knowledge_conflict(uuid,uuid,text,integer,integer) to authenticated;

-- Conservative potential-conflict detection: exact rule heading, different
-- monetary/percentage limits, overlapping applicability, separate processes.
-- This intentionally does not claim semantic detection of every contradiction.
create function public.detect_published_limit_conflict() returns trigger
language plpgsql security definer set search_path='' as $$
declare other public.knowledge_chunks; heading text; numbers text[]; other_numbers text[];
begin
  if not new.approved or new.library_archived_at is not null or (new.rule_id is null and new.source_type not in('owner_answer','rule')) then return new; end if;
  heading=lower(trim(split_part(new.content,':',1)));
  if length(heading)<5 or position(':' in new.content)=0 then return new; end if;
  select array_agg(distinct x[1] order by x[1]) into numbers from regexp_matches(new.content,'(\$[0-9][0-9,.]*|[0-9]+(?:\.[0-9]+)?%)','g') x;
  if numbers is null then return new; end if;
  for other in select * from public.knowledge_chunks k where k.organization_id=new.organization_id and k.id<>new.id
    and k.approved and k.library_archived_at is null and (k.rule_id is not null or k.source_type in('owner_answer','rule'))
    and (k.process_id is null or new.process_id is null or k.process_id is distinct from new.process_id)
    and lower(trim(split_part(k.content,':',1)))=heading and public.knowledge_scopes_overlap(k.scope,new.scope)
    and not exists(select 1 from public.processes p where p.organization_id=new.organization_id
      and ((p.id=new.process_id and p.supersedes_process_id=k.process_id) or (p.id=k.process_id and p.supersedes_process_id=new.process_id)))
    order by k.id limit 20 loop
    select array_agg(distinct x[1] order by x[1]) into other_numbers from regexp_matches(other.content,'(\$[0-9][0-9,.]*|[0-9]+(?:\.[0-9]+)?%)','g') x;
    if other_numbers is not null and numbers is distinct from other_numbers and not exists(
      select 1 from public.knowledge_conflicts f where f.organization_id=new.organization_id and f.status='open'
      and new.id in(f.knowledge_chunk_a,f.knowledge_chunk_b) and other.id in(f.knowledge_chunk_a,f.knowledge_chunk_b)) then
      insert into public.knowledge_conflicts(organization_id,knowledge_chunk_a,knowledge_chunk_b,conflict_type,explanation)
      values(new.organization_id,least(new.id,other.id),greatest(new.id,other.id),'conflict',
        'Potential conflict: the same rule heading has different monetary or percentage limits. A person must decide which guidance applies.');
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.detect_published_limit_conflict() from public,anon,authenticated,service_role;
create trigger detect_published_limit_conflict after insert or update of content,approved,scope on public.knowledge_chunks
for each row execute function public.detect_published_limit_conflict();
