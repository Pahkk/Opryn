-- Preserve the existing routing/authority abstraction; choose the narrowest area first.
create or replace function public.find_company_knowledge_expert(target_organization_id uuid, question_text text, closest_chunk_id uuid default null)
returns table (user_id uuid, full_name text, assignment_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if char_length(question_text) > 8000 then raise exception 'Question too long'; end if;
  return query
    select e.user_id, coalesce(nullif(p.full_name, ''), 'Company expert'), e.id
    from public.knowledge_experts e
    join public.organization_members m on m.organization_id=e.organization_id and m.user_id=e.user_id
    join public.profiles p on p.id=e.user_id
    where e.organization_id=target_organization_id and (
      (e.knowledge_chunk_id=closest_chunk_id and exists (
        select 1 from public.knowledge_chunks k where k.id=closest_chunk_id and k.organization_id=target_organization_id
          and (auth.role()='service_role' or public.is_org_admin(target_organization_id) or k.role_id is null
            or exists(select 1 from public.organization_members caller where caller.organization_id=target_organization_id
              and caller.user_id=auth.uid() and caller.role_id=k.role_id))
      ))
      or (nullif(trim(e.category),'') is not null and not exists (
        select 1 from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word
        where char_length(word)>2 and not exists (
          select 1 from regexp_split_to_table(lower(question_text),'[^[:alnum:]]+') question_word
          where regexp_replace(question_word,'s$','')=regexp_replace(word,'s$','')
        )
      ) and exists(select 1 from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word where char_length(word)>2))
    )
    order by (e.knowledge_chunk_id=closest_chunk_id) desc nulls last,
      (select count(*) from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word where char_length(word)>2) desc,
      e.priority,e.id limit 1;
end; $$;
revoke all on function public.find_company_knowledge_expert(uuid,text,uuid) from public,anon;
grant execute on function public.find_company_knowledge_expert(uuid,text,uuid) to authenticated,service_role;
