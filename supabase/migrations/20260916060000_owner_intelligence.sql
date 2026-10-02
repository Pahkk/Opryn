-- Aggregations, not surveillance: no individual rankings or invented savings.
create function public.owner_knowledge_intelligence(target_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since_at timestamptz:=now()-interval '30 days';v jsonb;top_gap jsonb;rec jsonb;minutes_per_question numeric;eligible integer;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
 select least(greatest(coalesce(estimated_interruption_minutes,3),0.1),30) into minutes_per_question from public.organization_settings where organization_id=target_org;
 minutes_per_question:=coalesce(minutes_per_question,3);
 select count(*) into eligible from (select distinct q.asked_by,(q.created_at at time zone 'UTC')::date,lower(regexp_replace(trim(q.question),'[[:space:]]+',' ','g'))
   from public.employee_questions q join public.organization_members m on m.organization_id=q.organization_id and m.user_id=q.asked_by and m.permission_level='employee'
   where q.organization_id=target_org and q.created_at>=since_at and q.answered_by_opryn and q.status='answered' and not q.escalated
     and q.origin in('employee','web','slack','teams') and not exists(select 1 from public.knowledge_feedback f where f.organization_id=target_org and f.question_id=q.id and f.feedback_type='not_right')
 ) deduplicated;
 with interactions as (
   select cluster_id,created_at,origin channel,escalated,status='needs_owner' pending from public.employee_questions where organization_id=target_org and created_at>=since_at
   union all select cluster_id,created_at,'external_ai',escalated,status='open' from public.external_ai_escalations where organization_id=target_org and created_at>=since_at
 ), grouped as (
   select c.id,c.topic,c.representative_question,count(*) question_count,count(*) filter(where i.escalated) interruptions,count(distinct i.channel) channels,max(i.created_at) last_seen
   from public.question_clusters c join interactions i on i.cluster_id=c.id where c.organization_id=target_org and c.status='open'
   group by c.id,c.topic,c.representative_question having bool_or(i.pending)
 ) select jsonb_build_object('id',id,'title',topic,'question',representative_question,'questions',question_count,'interruptions',interruptions,'channels',channels)
   into top_gap from grouped order by question_count desc,interruptions desc,last_seen desc limit 1;
 select jsonb_build_object('type','conflict','title','Resolve conflicting guidance','reason','Critical guidance has an unresolved source conflict. A person needs to choose the rule.','href','/app/needs-you?item=conflict-'||c.id::text,'action','Review conflict')
 into rec from public.knowledge_conflicts c join public.knowledge_chunks k on k.id in(c.knowledge_chunk_a,c.knowledge_chunk_b) and k.organization_id=c.organization_id
 where c.organization_id=target_org and c.status='open' and c.conflict_type='conflict' and k.criticality='critical' order by c.created_at desc limit 1;
 if rec is null and top_gap is not null then rec:=jsonb_build_object('type','gap','title',top_gap->>'title','reason',format('Asked %s times across %s channels in the last 30 days. Reached a human %s times.',top_gap->>'questions',top_gap->>'channels',top_gap->>'interruptions'),
   'href','/app/needs-you','action','Answer this gap','question',top_gap->>'question'); end if;
 if rec is null then select jsonb_build_object('type','source_update','title',s.title,'reason','Selected source findings await human review. Current approved guidance remains active.','href','/app/processes/'||s.process_id::text,'action','Review source findings')
   into rec from public.integration_sources s where s.organization_id=target_org and s.review_status='pending' and s.process_id is not null and s.process_id is distinct from s.approved_process_id order by s.last_imported_at desc nulls last limit 1; end if;
 if rec is null then select jsonb_build_object('type','freshness','title',left(k.content,100),'reason',format('Used %s times in total; its confirmation is overdue. Confirm the guidance before relying on it.',''||k.usage_count),'href','/app/knowledge/health#freshness','action','Check freshness')
   into rec from public.knowledge_chunks k where k.organization_id=target_org and k.approved and k.library_archived_at is null and k.usage_count>0
   and coalesce(k.last_confirmed_at,k.created_at)<now()-case when k.criticality='critical' then interval '90 days' else interval '180 days' end
   order by k.usage_count desc limit 1; end if;
 select jsonb_build_object(
   'handledTeam',(select count(*) from public.employee_questions where organization_id=target_org and created_at>=since_at and answered_by_opryn and status='answered' and not escalated),
   'handledAI',(select count(*) from public.external_ai_activity where organization_id=target_org and created_at>=since_at and endpoint='answer' and result_status='answered'),
   'escalated',(select count(*) from public.employee_questions where organization_id=target_org and created_at>=since_at and escalated)+(select count(*) from public.external_ai_escalations where organization_id=target_org and created_at>=since_at and escalated),
   'openGaps',(select count(*) from public.question_clusters where organization_id=target_org and status='open'),
   'resolvedGaps',(select count(*) from public.question_clusters where organization_id=target_org and status='resolved' and updated_at>=since_at),
   'humanKnowledge',(select count(*) from public.knowledge_proposals p where p.organization_id=target_org and p.status='approved' and p.updated_at>=since_at and (p.related_question_id is not null or exists(select 1 from public.external_ai_escalations e where e.organization_id=target_org and e.knowledge_proposal_id=p.id))),
   'estimatedMinutes',round(eligible*minutes_per_question),'eligibleQuestions',eligible,'minutesPerQuestion',minutes_per_question,
   'recommendation',rec,'topGap',top_gap,'periodDays',30,
   'aiLogsLimitedByRetention',exists(select 1 from public.external_ai_connections where organization_id=target_org and activity_retention_days<30),
   'keyPersonDependencies',coalesce((with routes as (
     select cluster_id,assigned_expert_id assigned_to from public.employee_questions where organization_id=target_org and created_at>=since_at and status='needs_owner' and escalated and assigned_expert_id is not null
     union all select cluster_id,assigned_to from public.external_ai_escalations where organization_id=target_org and created_at>=since_at and status='open' and escalated and assigned_to is not null
   ) select jsonb_agg(risk) from(select c.id,c.topic,count(*) questions from routes r join public.question_clusters c on c.id=r.cluster_id and c.organization_id=target_org
     where c.status='open' group by c.id,c.topic having count(distinct assigned_to)=1 and count(*)>=3 order by count(*) desc limit 10) risk),'[]')
 ) into v;
 return v;
end $$;
revoke all on function public.owner_knowledge_intelligence(uuid) from public,anon;
grant execute on function public.owner_knowledge_intelligence(uuid) to authenticated;

create table public.company_analysis_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid references public.profiles(id) on delete set null,source_ids uuid[] not null check(cardinality(source_ids) between 1 and 2),
 status text not null default 'running' check(status in('running','complete','partial','failed')),
 result jsonb not null default '{}',created_at timestamptz not null default now(),finished_at timestamptz
);
create unique index company_analysis_one_running on public.company_analysis_runs(organization_id) where status='running';
alter table public.company_analysis_runs enable row level security;
create policy company_analysis_admin_read on public.company_analysis_runs for select to authenticated using(public.is_org_admin(organization_id));
revoke all on public.company_analysis_runs from anon,authenticated;grant select on public.company_analysis_runs to authenticated;grant all on public.company_analysis_runs to service_role;
create function public.start_company_analysis(target_org uuid,source_ids_value uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
 if coalesce(cardinality(source_ids_value),0) not between 1 and 2 or cardinality(source_ids_value)<>(select count(distinct x) from unnest(source_ids_value) x) then raise exception 'Choose one or two selected sources' using errcode='22023'; end if;
 if exists(select 1 from unnest(source_ids_value) selected where not exists(select 1 from public.integration_sources s join public.integrations i on i.id=s.integration_id and i.organization_id=s.organization_id
   where s.id=selected and s.organization_id=target_org and s.provider in('notion','confluence','google_drive') and i.status='connected')) then raise exception 'Source unavailable or outside workspace' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_org::text||':company-analysis',0));
 update public.company_analysis_runs set status='failed',finished_at=now(),result='{"interrupted":true}' where organization_id=target_org and status='running' and created_at<now()-interval '10 minutes';
 if exists(select 1 from public.company_analysis_runs where organization_id=target_org and status='running') then raise exception 'Analysis already running' using errcode='40001'; end if;
 insert into public.company_analysis_runs(organization_id,created_by,source_ids) values(target_org,auth.uid(),source_ids_value) returning id into run_id;
 return run_id;
end $$;
revoke all on function public.start_company_analysis(uuid,uuid[]) from public,anon;
grant execute on function public.start_company_analysis(uuid,uuid[]) to authenticated;
