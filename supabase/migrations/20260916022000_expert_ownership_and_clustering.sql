alter table public.knowledge_experts
  add column assignment_type text not null default 'category'
    check(assignment_type in ('category','subject','tag','process','business_area')),
  add column process_id uuid references public.processes(id) on delete cascade;

create or replace function public.find_company_knowledge_expert(target_organization_id uuid, question_text text, closest_chunk_id uuid default null)
returns table(user_id uuid,full_name text,assignment_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if char_length(question_text)>8000 then raise exception 'Question too long'; end if;
  return query select e.user_id,coalesce(nullif(p.full_name,''),'Company expert'),e.id
    from public.knowledge_experts e join public.organization_members m on m.organization_id=e.organization_id and m.user_id=e.user_id
    join public.profiles p on p.id=e.user_id
    where e.organization_id=target_organization_id
      and (e.process_id is null or exists(select 1 from public.processes process where process.id=e.process_id and process.organization_id=target_organization_id))
      and ((exists(select 1 from public.knowledge_chunks k where k.id=closest_chunk_id and k.organization_id=target_organization_id
        and (e.knowledge_chunk_id=k.id or (e.process_id is not null and e.process_id=k.process_id)
          or (e.assignment_type='tag' and exists(select 1 from unnest(k.library_tags) tag where lower(tag)=lower(e.category))))
        and (auth.role()='service_role' or public.is_org_admin(target_organization_id) or k.role_id is null
          or exists(select 1 from public.organization_members caller where caller.organization_id=target_organization_id
            and caller.user_id=auth.uid() and caller.role_id=k.role_id))))
      or (nullif(trim(e.category),'') is not null and not exists(
        select 1 from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word where char_length(word)>2
          and not exists(select 1 from regexp_split_to_table(lower(question_text),'[^[:alnum:]]+') question_word
            where regexp_replace(question_word,'s$','')=regexp_replace(word,'s$','')))
        and exists(select 1 from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word where char_length(word)>2)))
    order by (e.knowledge_chunk_id=closest_chunk_id) desc nulls last,
      (e.process_id is not null and exists(select 1 from public.knowledge_chunks k where k.id=closest_chunk_id
        and k.organization_id=target_organization_id and k.process_id=e.process_id)) desc,
      (select count(*) from regexp_split_to_table(lower(trim(e.category)),'[^[:alnum:]]+') word where char_length(word)>2) desc,
      case e.assignment_type when 'process' then 0 when 'subject' then 1 when 'tag' then 2 when 'business_area' then 3 else 4 end,
      e.priority,e.id limit 1;
end; $$;

-- One writer per workspace prevents concurrent semantic lookups creating parallel clusters.
-- Keep the existing conservative similarity gate. Explicit one-off exceptions stay separate.
create or replace function public.record_question_cluster(target_organization_id uuid,question_text text,
  question_embedding extensions.vector(1536),question_origin text default 'employee') returns uuid
language plpgsql security definer set search_path='' as $$
declare matched_id uuid; exception_context boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_org_member(target_organization_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if question_origin not in ('employee','external_ai','slack','teams','mcp_chatgpt','mcp_claude','mcp_custom') then raise exception 'Invalid question origin'; end if;
  if nullif(trim(question_text),'') is null or char_length(question_text)>8000 then raise exception 'Invalid question'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_organization_id::text||':gap-cluster',0));
  exception_context:=question_text ~* '(for this (customer|order|case) only|one[- ]time exception|just this once)';
  select cluster.id into matched_id from public.question_clusters cluster
    where cluster.organization_id=target_organization_id and cluster.status='open' and cluster.embedding is not null
      and (cluster.representative_question ~* '(for this (customer|order|case) only|one[- ]time exception|just this once)')=exception_context
      and 1-(cluster.embedding operator(extensions.<=>) question_embedding)>=0.84
    order by cluster.embedding operator(extensions.<=>) question_embedding,cluster.id limit 1 for update;
  if matched_id is null then
    insert into public.question_clusters(organization_id,topic,representative_question,embedding,employee_count,agent_count,classification)
      values(target_organization_id,left(trim(question_text),240),trim(question_text),question_embedding,
        case when question_origin in ('employee','slack','teams') then 1 else 0 end,
        case when question_origin in ('external_ai','mcp_chatgpt','mcp_claude','mcp_custom') then 1 else 0 end,
        case when exception_context then 'one_time_exception' else 'missing_answer' end) returning id into matched_id;
  else
    update public.question_clusters set question_count=question_count+1,updated_at=now(),
      employee_count=employee_count+case when question_origin in ('employee','slack','teams') then 1 else 0 end,
      agent_count=agent_count+case when question_origin in ('external_ai','mcp_chatgpt','mcp_claude','mcp_custom') then 1 else 0 end where id=matched_id;
  end if;
  return matched_id;
end; $$;
