-- Additive training layer. Existing process assignments/test cases remain valid.
-- Canonical policy text stays exclusively in knowledge_chunks/knowledge_versions.
alter table public.training_assignments alter column process_id drop not null;
alter table public.training_assignments
 add column knowledge_chunk_id uuid,
 add column required_version integer,
 add column acknowledged_version integer,
 add column passed_version integer,
 add column update_required boolean not null default false,
 add column previous_version integer,
 add constraint training_knowledge_org foreign key(knowledge_chunk_id,organization_id) references public.knowledge_chunks(id,organization_id),
 add constraint training_single_reference check(num_nonnulls(process_id,knowledge_chunk_id)=1),
 add constraint training_user_knowledge unique(user_id,knowledge_chunk_id),
 add constraint training_identity_org unique(id,organization_id);
create index training_knowledge_consumers on public.training_assignments(organization_id,knowledge_chunk_id,user_id);

create table public.role_knowledge_requirements(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 role_id uuid not null,knowledge_chunk_id uuid not null,
 stage text not null default 'core' check(stage in('day_one','core','advanced')),
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 primary key(role_id,knowledge_chunk_id),
 foreign key(role_id,organization_id) references public.roles(id,organization_id),
 foreign key(knowledge_chunk_id,organization_id) references public.knowledge_chunks(id,organization_id)
);
alter table public.role_knowledge_requirements enable row level security;
create policy role_knowledge_read on public.role_knowledge_requirements for select to authenticated using(public.is_org_admin(organization_id) or exists(select 1 from public.organization_members m where m.organization_id=role_knowledge_requirements.organization_id and m.user_id=auth.uid() and m.role_id=role_knowledge_requirements.role_id));
revoke all on public.role_knowledge_requirements from anon,authenticated;
grant select on public.role_knowledge_requirements to authenticated;
grant all on public.role_knowledge_requirements to service_role;

create table public.training_scenarios(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 knowledge_chunk_id uuid not null,knowledge_version integer not null,
 format text not null check(format in('acknowledgement','scenario','short_answer','recognition','step_order','responsibility')),
 prompt text not null check(length(prompt) between 3 and 2000),
 -- Only an exact excerpt can be expected guidance; never another policy copy.
 supporting_quote text not null check(length(supporting_quote) between 1 and 4000),
 status text not null default 'draft' check(status in('draft','approved','update_required','retired')),
 revision integer not null default 1,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 unique(id,organization_id),foreign key(knowledge_chunk_id,organization_id) references public.knowledge_chunks(id,organization_id)
);
alter table public.training_scenarios enable row level security;
create policy scenario_read on public.training_scenarios for select to authenticated using(public.is_org_admin(organization_id) or (status='approved' and exists(select 1 from public.training_assignments a where a.organization_id=training_scenarios.organization_id and a.knowledge_chunk_id=training_scenarios.knowledge_chunk_id and a.user_id=auth.uid())));
revoke all on public.training_scenarios from anon,authenticated;
grant select on public.training_scenarios to authenticated;grant all on public.training_scenarios to service_role;
create unique index one_active_training_scenario on public.training_scenarios(organization_id,knowledge_chunk_id) where status='approved';

create table public.training_attempts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 assignment_id uuid,user_id uuid references public.profiles(id) on delete set null,knowledge_chunk_id uuid not null,
 knowledge_version integer not null,scenario_id uuid,scenario_revision integer,
 outcome text not null check(outcome in('acknowledged','supported','practice_needed','review')),
 response text check(length(response)<=3000),feedback text check(length(feedback)<=2000),
 created_at timestamptz not null default now(),
 foreign key(assignment_id,organization_id) references public.training_assignments(id,organization_id) on delete set null (assignment_id),
 foreign key(knowledge_chunk_id,organization_id) references public.knowledge_chunks(id,organization_id),
 foreign key(scenario_id,organization_id) references public.training_scenarios(id,organization_id)
);
alter table public.training_attempts enable row level security;
create policy attempts_read on public.training_attempts for select to authenticated using(public.is_org_admin(organization_id) or (public.is_org_member(organization_id) and user_id=auth.uid()));
revoke all on public.training_attempts from anon,authenticated;grant select on public.training_attempts to authenticated;grant all on public.training_attempts to service_role;
create index training_attempt_history on public.training_attempts(organization_id,assignment_id,created_at desc);

-- Audit events use no source bodies. Keep them separate from the constrained legacy event enum.
create table public.training_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 event_type text not null,actor_id uuid references public.profiles(id) on delete set null,entity_id uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.training_events enable row level security;
create policy training_events_read on public.training_events for select to authenticated using(public.is_org_admin(organization_id));
revoke all on public.training_events from anon,authenticated;grant select on public.training_events to authenticated;grant all on public.training_events to service_role;
create index training_events_org on public.training_events(organization_id,created_at desc);

alter table public.external_ai_connections add column configuration_version integer not null default 1,
 add column behavior_rules text not null default 'Use only approved, authorized guidance. Never invent company policy. Escalate when approved guidance is missing.' check(length(behavior_rules)<=4000);
alter table public.knowledge_test_cases add column retired_at timestamptz, add column evaluation_version integer not null default 1,
 add column expected_behavior text not null default '' check(length(expected_behavior)<=2000),
 add column needs_rerun boolean not null default true,
 add column agent_response_required boolean not null default false,
 add column agent_response_needs_update boolean not null default false,
 add column last_agent_result jsonb,
 add constraint knowledge_test_identity_org unique(id,organization_id);
create table public.agent_evaluation_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 test_id uuid not null,connection_id uuid not null references public.external_ai_connections(id),
 evaluation_version integer not null,configuration_version integer not null,
 status text not null default 'queued' check(status in('queued','running','passed','failed','knowledge_gap','review','error','superseded')),
 execution_mode text not null default 'opryn_context' check(execution_mode in('opryn_context','agent_response')),
 submitted_response jsonb,submission_id uuid,origin_api_key_id uuid references public.external_ai_api_keys(id) on delete set null,
 attempts integer not null default 0,available_at timestamptz not null default now(),locked_at timestamptz,
 result jsonb,error_code text,created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(test_id,organization_id) references public.knowledge_test_cases(id,organization_id)
);
alter table public.agent_evaluation_runs enable row level security;
create policy agent_runs_read on public.agent_evaluation_runs for select to authenticated using(public.is_org_admin(organization_id));
revoke all on public.agent_evaluation_runs from anon,authenticated;grant select on public.agent_evaluation_runs to authenticated;grant all on public.agent_evaluation_runs to service_role;
create index evaluation_queue on public.agent_evaluation_runs(status,available_at);
create index evaluation_history on public.agent_evaluation_runs(organization_id,connection_id,created_at desc);
create unique index evaluation_one_pending on public.agent_evaluation_runs(test_id) where status in('queued','running');

create function public.queue_agent_training_test(target_org uuid,target_test uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.knowledge_test_cases;c public.external_ai_connections;run_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' and not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into t from public.knowledge_test_cases where id=target_test and organization_id=target_org;
 select * into c from public.external_ai_connections where id=t.connection_id and organization_id=target_org;
 if c.id is null or c.status<>'active' or t.retired_at is not null then raise exception 'Workspace agent test unavailable' using errcode='42501';end if;
 insert into public.agent_evaluation_runs(organization_id,test_id,connection_id,evaluation_version,configuration_version)
 values(target_org,t.id,c.id,t.evaluation_version,c.configuration_version) on conflict(test_id) where status in('queued','running') do nothing returning id into run_id;
 if run_id is null then select id into run_id from public.agent_evaluation_runs where test_id=t.id and organization_id=target_org and status in('queued','running');end if;
 update public.knowledge_test_cases set needs_rerun=true where id=t.id and organization_id=target_org;
 return run_id;
end $$;
revoke all on function public.queue_agent_training_test(uuid,uuid) from public,anon;grant execute on function public.queue_agent_training_test(uuid,uuid) to authenticated,service_role;

create function public.assign_role_knowledge(target_org uuid,target_role uuid,knowledge_ids uuid[],learning_stage text default 'core') returns integer
language plpgsql security definer set search_path='' as $$
declare k public.knowledge_chunks;key uuid;count_value integer:=0;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 if not exists(select 1 from public.roles where id=target_role and organization_id=target_org) or coalesce(array_length(knowledge_ids,1),0) not between 1 and 100 or learning_stage not in('day_one','core','advanced') then raise exception 'Choose role and knowledge' using errcode='22023';end if;
 foreach key in array knowledge_ids loop
 select * into k from public.knowledge_chunks where id=key and organization_id=target_org and approved and library_archived_at is null for share;
 if k.id is null or (k.role_id is not null and k.role_id<>target_role) then raise exception 'Knowledge unavailable to this role' using errcode='42501';end if;
 insert into public.role_knowledge_requirements(organization_id,role_id,knowledge_chunk_id,stage,created_by) values(target_org,target_role,k.id,learning_stage,auth.uid()) on conflict(role_id,knowledge_chunk_id) do update set stage=excluded.stage;
 insert into public.training_assignments(organization_id,user_id,knowledge_chunk_id,required_version,origin_role_id)
 select target_org,m.user_id,k.id,k.current_version,target_role from public.organization_members m where m.organization_id=target_org and m.role_id=target_role on conflict(user_id,knowledge_chunk_id) do update set retired_at=null,origin_role_id=excluded.origin_role_id;
 count_value:=count_value+1;
 end loop;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id,metadata) values(target_org,'training_assigned',auth.uid(),target_role,jsonb_build_object('knowledge_ids',knowledge_ids));
 return count_value;
end $$;
revoke all on function public.assign_role_knowledge(uuid,uuid,uuid[],text) from public,anon;grant execute on function public.assign_role_knowledge(uuid,uuid,uuid[],text) to authenticated;
create function public.sync_member_knowledge_training() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.training_assignments(organization_id,user_id,knowledge_chunk_id,required_version,origin_role_id)
 select new.organization_id,new.user_id,k.id,k.current_version,new.role_id from public.role_knowledge_requirements r join public.knowledge_chunks k on k.id=r.knowledge_chunk_id and k.organization_id=r.organization_id where r.organization_id=new.organization_id and r.role_id=new.role_id and k.approved and k.library_archived_at is null on conflict(user_id,knowledge_chunk_id) do update set retired_at=null,origin_role_id=excluded.origin_role_id;
 return new;
end $$;
create trigger sync_member_knowledge_training after insert or update of role_id on public.organization_members for each row execute function public.sync_member_knowledge_training();

-- Conservative semantic impact: only whitespace differences are safely ignored.
-- Threshold, negation, punctuation, scope, role, approval and archive changes invalidate.
create function public.training_material_change(old_content text,new_content text,old_scope jsonb,new_scope jsonb) returns boolean
language sql immutable set search_path='' as $$select regexp_replace(trim(old_content),'\s+',' ','g') is distinct from regexp_replace(trim(new_content),'\s+',' ','g') or old_scope is distinct from new_scope$$;
create function public.propagate_training_knowledge() returns trigger language plpgsql security definer set search_path='' as $$
declare material boolean;t record;
begin
 material:=public.training_material_change(old.content,new.content,old.scope,new.scope) or old.approved is distinct from new.approved or old.library_archived_at is distinct from new.library_archived_at or old.role_id is distinct from new.role_id or old.health_status is distinct from new.health_status;
 if not material then
   if new.current_version<>old.current_version then
    update public.training_assignments set required_version=new.current_version,acknowledged_version=case when acknowledged_version=old.current_version then new.current_version else acknowledged_version end,passed_version=case when passed_version=old.current_version then new.current_version else passed_version end where organization_id=new.organization_id and knowledge_chunk_id=new.id;
    update public.training_scenarios set knowledge_version=new.current_version where organization_id=new.organization_id and knowledge_chunk_id=new.id and status='approved';
   end if;
   return new;
 end if;
 update public.training_assignments set previous_version=coalesce(previous_version,required_version),required_version=new.current_version,update_required=true,passed_version=null,acknowledged_version=null where organization_id=new.organization_id and knowledge_chunk_id=new.id;
 update public.training_scenarios set status=case when format='acknowledgement' and new.approved and new.library_archived_at is null and new.health_status='healthy' then 'approved' else 'update_required' end,
 knowledge_version=case when format='acknowledgement' then new.current_version else knowledge_version end,
 supporting_quote=case when format='acknowledgement' then left(new.content,4000) else supporting_quote end,
 revision=revision+1 where organization_id=new.organization_id and knowledge_chunk_id=new.id and status='approved';
 update public.knowledge_test_cases set needs_rerun=true,agent_response_needs_update=agent_response_required where organization_id=new.organization_id and (new.id=any(expected_knowledge_ids) or new.id=any(linked_knowledge_ids));
 for t in select id from public.knowledge_test_cases where organization_id=new.organization_id and retired_at is null and connection_id is not null and (new.id=any(expected_knowledge_ids) or new.id=any(linked_knowledge_ids) or last_result->>'type'='unknown') loop
   perform public.queue_agent_training_test(new.organization_id,t.id);
 end loop;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id,metadata) values(new.organization_id,'knowledge_update_propagated',auth.uid(),new.id,jsonb_build_object('before_version',old.current_version,'after_version',new.current_version));
 return new;
end $$;
create trigger training_knowledge_changed after update on public.knowledge_chunks for each row execute function public.propagate_training_knowledge();

create function public.training_agent_configuration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.knowledge_policy,new.knowledge_mode,new.unknown_behavior,new.behavior_rules,new.status) is distinct from (old.knowledge_policy,old.knowledge_mode,old.unknown_behavior,old.behavior_rules,old.status) then
 new.configuration_version:=old.configuration_version+1;
 update public.knowledge_test_cases set needs_rerun=true,agent_response_needs_update=agent_response_required where organization_id=new.organization_id and connection_id=new.id;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id,metadata) values(new.organization_id,'agent_permission_changed',auth.uid(),new.id,jsonb_build_object('configuration_version',new.configuration_version));
 end if;
 return new;
end $$;
create trigger training_agent_configuration before update on public.external_ai_connections for each row execute function public.training_agent_configuration();

create function public.claim_training_evaluation() returns setof public.agent_evaluation_runs language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker required' using errcode='42501';end if;
 update public.agent_evaluation_runs set status=case when attempts>=3 then 'error' else 'queued' end,error_code='evaluation_timeout',locked_at=null where status='running' and locked_at<now()-interval '5 minutes';
 return query update public.agent_evaluation_runs set status='running',attempts=attempts+1,locked_at=now() where id=(select id from public.agent_evaluation_runs where status='queued' and available_at<=now() order by available_at for update skip locked limit 1) returning *;
end $$;
revoke all on function public.claim_training_evaluation() from public,anon,authenticated;grant execute on function public.claim_training_evaluation() to service_role;

-- Evidence commits atomically and checks version/access again after model execution.
create function public.commit_training_attempt(target_org uuid,target_user uuid,target_assignment uuid,expected_version integer,target_scenario uuid,expected_scenario_revision integer,outcome_value text,response_value text,feedback_value text)
returns void language plpgsql security definer set search_path='' as $$
declare a public.training_assignments;k public.knowledge_chunks;s public.training_scenarios;m public.organization_members;context_value jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Evidence service required' using errcode='42501';end if;
 select * into a from public.training_assignments where id=target_assignment and organization_id=target_org and user_id=target_user and retired_at is null for update;
 select * into k from public.knowledge_chunks where id=a.knowledge_chunk_id and organization_id=target_org for share;
 select * into m from public.organization_members where organization_id=target_org and user_id=target_user for share;
 if m.user_id is null or k.id is null or not k.approved or k.library_archived_at is not null or (k.role_id is not null and k.role_id is distinct from m.role_id and m.permission_level not in('owner','admin')) then raise exception 'Knowledge access unavailable' using errcode='42501';end if;
 context_value:=jsonb_build_object('channels',jsonb_build_array('employee'),'roles',coalesce((select jsonb_build_array(r.id::text,r.name) from public.roles r where r.id=m.role_id and r.organization_id=target_org),'[]'::jsonb));
 if public.knowledge_scope_match(k.scope,context_value)<>'matches' or k.health_status<>'healthy' or exists(select 1 from public.knowledge_conflicts c where c.organization_id=target_org and c.status='open' and c.conflict_type='conflict' and k.id in(c.knowledge_chunk_a,c.knowledge_chunk_b)) then raise exception 'Guidance requires review or scope context' using errcode='23514';end if;
 if k.current_version<>expected_version or a.required_version<>expected_version then raise exception 'Guidance changed' using errcode='40001';end if;
 if outcome_value not in('acknowledged','supported','practice_needed','review') then raise exception 'Invalid outcome';end if;
 if outcome_value<>'acknowledged' then
 select * into s from public.training_scenarios where id=target_scenario and organization_id=target_org and knowledge_chunk_id=k.id and status='approved' and knowledge_version=expected_version and revision=expected_scenario_revision for share;
 if s.id is null or position(regexp_replace(trim(s.supporting_quote),'\s+',' ','g') in regexp_replace(trim(k.content),'\s+',' ','g'))=0 then raise exception 'Scenario changed' using errcode='40001';end if;
 end if;
 insert into public.training_attempts(organization_id,assignment_id,user_id,knowledge_chunk_id,knowledge_version,scenario_id,scenario_revision,outcome,response,feedback) values(target_org,a.id,target_user,k.id,expected_version,target_scenario,expected_scenario_revision,outcome_value,response_value,feedback_value);
 update public.training_assignments set acknowledged_version=case when outcome_value='acknowledged' then expected_version else acknowledged_version end,passed_version=case when outcome_value='supported' then expected_version when outcome_value in('practice_needed','review') then null else passed_version end,update_required=false,previous_version=null,learning_state=case when outcome_value='acknowledged' then 'acknowledged' else 'practiced' end,started_at=coalesce(started_at,now()),completed_at=case when outcome_value='supported' then now() else completed_at end where id=a.id;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id,metadata) values(target_org,case when a.update_required then 'training_update_completed' else 'training_activity' end,target_user,a.id,jsonb_build_object('outcome',outcome_value,'version',expected_version));
end $$;
revoke all on function public.commit_training_attempt(uuid,uuid,uuid,integer,uuid,integer,text,text,text) from public,anon,authenticated;grant execute on function public.commit_training_attempt(uuid,uuid,uuid,integer,uuid,integer,text,text,text) to service_role;

-- Retain evidence when people change roles; never delete their approved-version history.
alter table public.training_assignments add column retired_at timestamptz;
create or replace function public.sync_member_role_learning() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.training_assignments where organization_id=new.organization_id and user_id=new.user_id and process_id is not null and origin_role_id is not null and origin_role_id is distinct from new.role_id;
 update public.training_assignments set retired_at=now() where organization_id=new.organization_id and user_id=new.user_id and knowledge_chunk_id is not null and origin_role_id is not null and origin_role_id is distinct from new.role_id;
 insert into public.training_assignments(organization_id,user_id,process_id,origin_role_id) select new.organization_id,new.user_id,r.process_id,r.role_id from public.role_learning_requirements r join public.processes p on p.id=r.process_id and p.organization_id=r.organization_id and p.status='approved' and p.library_archived_at is null where r.organization_id=new.organization_id and r.role_id=new.role_id on conflict(user_id,process_id) do nothing;
 return new;
end $$;
-- Block forged readiness, scenario publication, cross-tenant run links and stale results.
create function public.guard_training_scenario() returns trigger language plpgsql security definer set search_path='' as $$
declare k public.knowledge_chunks;
begin
 select * into k from public.knowledge_chunks where id=new.knowledge_chunk_id and organization_id=new.organization_id;
 if new.status='approved' and (not k.approved or k.library_archived_at is not null or k.current_version<>new.knowledge_version or position(regexp_replace(trim(new.supporting_quote),'\s+',' ','g') in regexp_replace(trim(k.content),'\s+',' ','g'))=0) then raise exception 'Scenario must reference current approved guidance' using errcode='23514';end if;
 return new;
end $$;
create trigger guard_training_scenario before insert or update on public.training_scenarios for each row execute function public.guard_training_scenario();
create function public.guard_training_run() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.external_ai_connections c join public.knowledge_test_cases t on t.connection_id=c.id and t.organization_id=c.organization_id where c.id=new.connection_id and c.organization_id=new.organization_id and t.id=new.test_id) then raise exception 'Workspace test connection required' using errcode='42501';end if;
 return new;
end $$;
create trigger guard_training_run before insert or update on public.agent_evaluation_runs for each row execute function public.guard_training_run();
-- Training feedback uses the established Needs You knowledge-feedback workflow.
alter table public.knowledge_feedback alter column question_id drop not null;
create function public.report_training_feedback(target_org uuid,target_knowledge uuid,feedback_reason text,feedback_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if auth.uid() is null or not public.is_org_member(target_org) or not exists(select 1 from public.training_assignments a where a.organization_id=target_org and a.knowledge_chunk_id=target_knowledge and a.user_id=auth.uid() and a.retired_at is null) then raise exception 'Assigned training required' using errcode='42501';end if;
 if feedback_reason not in('outdated','wrong_policy','missing_information','other') or length(feedback_note)>2000 then raise exception 'Invalid feedback';end if;
 select id into result_id from public.knowledge_feedback where organization_id=target_org and knowledge_chunk_id=target_knowledge and user_id=auth.uid() and question_id is null and status='open' limit 1;
 if result_id is not null then return result_id;end if;
 insert into public.knowledge_feedback(organization_id,knowledge_chunk_id,user_id,feedback_type,reason,note) values(target_org,target_knowledge,auth.uid(),'not_right',feedback_reason,feedback_note) returning id into result_id;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id) values(target_org,'knowledge_gap_discovered_through_training',auth.uid(),target_knowledge);
 return result_id;
end $$;
revoke all on function public.report_training_feedback(uuid,uuid,text,text) from public,anon;grant execute on function public.report_training_feedback(uuid,uuid,text,text) to authenticated;
create function public.publish_training_scenario(target_org uuid,target_knowledge uuid,expected_version integer,format_value text,prompt_value text,quote_value text) returns uuid language plpgsql security definer set search_path='' as $$
declare k public.knowledge_chunks;result_id uuid;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into k from public.knowledge_chunks where id=target_knowledge and organization_id=target_org for update;
 if k.id is null or not k.approved or k.library_archived_at is not null or k.current_version<>expected_version or length(trim(quote_value))=0 or position(quote_value in k.content)=0 then raise exception 'Current approved supporting quote required' using errcode='40001';end if;
 update public.training_scenarios set status='retired' where organization_id=target_org and knowledge_chunk_id=k.id and status in('approved','update_required','draft');
 insert into public.training_scenarios(organization_id,knowledge_chunk_id,knowledge_version,format,prompt,supporting_quote,status,created_by) values(target_org,k.id,expected_version,format_value,prompt_value,quote_value,'approved',auth.uid()) returning id into result_id;
 update public.training_assignments set passed_version=null where organization_id=target_org and knowledge_chunk_id=k.id;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id) values(target_org,'training_scenario_approved',auth.uid(),result_id);
 return result_id;
end $$;
revoke all on function public.publish_training_scenario(uuid,uuid,integer,text,text,text) from public,anon;grant execute on function public.publish_training_scenario(uuid,uuid,integer,text,text,text) to authenticated;
create function public.finish_training_evaluation(target_run uuid,lease_attempt integer,result_value jsonb,status_value text) returns text language plpgsql security definer set search_path='' as $$
declare r public.agent_evaluation_runs;t public.knowledge_test_cases;c public.external_ai_connections;final_status text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Worker required' using errcode='42501';end if;
 select * into r from public.agent_evaluation_runs where id=target_run and status='running' and attempts=lease_attempt for update;
 if r.id is null then raise exception 'Lease expired' using errcode='40001';end if;
 select * into t from public.knowledge_test_cases where id=r.test_id and organization_id=r.organization_id for update;
 select * into c from public.external_ai_connections where id=r.connection_id and organization_id=r.organization_id for share;
 if status_value not in('passed','failed','knowledge_gap','review') then raise exception 'Invalid result';end if;
 final_status:=status_value;
 if t.retired_at is not null or (r.execution_mode='agent_response' and (not exists(select 1 from public.external_ai_api_keys a where a.id=r.origin_api_key_id and a.organization_id=r.organization_id and a.connection_id=r.connection_id and a.revoked_at is null) or not exists(select 1 from public.external_ai_scopes a where a.organization_id=r.organization_id and a.connection_id=r.connection_id and a.scope='evaluations:create'))) or c.configuration_version<>r.configuration_version or c.status<>'active' or t.evaluation_version<>r.evaluation_version or exists(select 1 from public.training_events e where e.organization_id=r.organization_id and e.event_type in('knowledge_update_propagated','approved_knowledge_added') and e.created_at>r.locked_at) or exists(select 1 from jsonb_array_elements(coalesce(result_value->'sources','[]')) source left join public.knowledge_chunks k on k.id=(source->>'id')::uuid and k.organization_id=r.organization_id where k.id is null or not k.approved or k.library_archived_at is not null or k.current_version<>(source->>'version')::integer) then final_status:='superseded';end if;
 update public.agent_evaluation_runs set status=final_status,result=case when final_status='superseded' then jsonb_build_object('reason','Knowledge or permissions changed; rerun required.') else result_value end,completed_at=now(),locked_at=null,error_code=null where id=r.id;
 if final_status<>'superseded' then
 update public.knowledge_test_cases set last_result=result_value,last_run_at=now(),last_agent_result=case when r.execution_mode='agent_response' then result_value else last_agent_result end,agent_response_needs_update=case when r.execution_mode='agent_response' then false else agent_response_needs_update end,linked_knowledge_ids=ARRAY(select (s->>'id')::uuid from jsonb_array_elements(coalesce(result_value->'sources','[]')) s),needs_rerun=false where id=t.id;
 elsif c.status='active' and t.retired_at is null then perform public.queue_agent_training_test(r.organization_id,t.id);
 end if;
 insert into public.training_events(organization_id,event_type,entity_id,metadata) values(r.organization_id,'agent_test_run',r.id,jsonb_build_object('status',final_status,'test_id',t.id,'execution_mode',r.execution_mode));
 return final_status;
end $$;
revoke all on function public.finish_training_evaluation(uuid,integer,jsonb,text) from public,anon,authenticated;grant execute on function public.finish_training_evaluation(uuid,integer,jsonb,text) to service_role;
create function public.training_new_knowledge() returns trigger language plpgsql security definer set search_path='' as $$
declare t record;
begin
 if new.approved then
 insert into public.training_events(organization_id,event_type,entity_id) values(new.organization_id,'approved_knowledge_added',new.id);
 for t in select id from public.knowledge_test_cases where organization_id=new.organization_id and retired_at is null and connection_id is not null and last_result->>'trainingStatus'='knowledge_gap' loop perform public.queue_agent_training_test(new.organization_id,t.id);end loop;
 end if;return new;
end $$;
create trigger training_new_knowledge after insert on public.knowledge_chunks for each row execute function public.training_new_knowledge();
create function public.training_operational_summary(target_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ready integer;updates integer;attention integer;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 select count(*) into ready from (select a.user_id from public.training_assignments a join public.knowledge_chunks k on k.id=a.knowledge_chunk_id and k.organization_id=a.organization_id join public.organization_members m on m.user_id=a.user_id and m.organization_id=a.organization_id left join public.training_scenarios s on s.knowledge_chunk_id=k.id and s.organization_id=k.organization_id and s.status='approved' where a.organization_id=target_org and a.knowledge_chunk_id is not null and a.retired_at is null group by a.user_id having bool_and(coalesce(k.approved and k.library_archived_at is null and k.health_status='healthy' and not a.update_required and a.acknowledged_version=k.current_version and s.knowledge_version=k.current_version and (s.format='acknowledgement' or a.passed_version=k.current_version) and (k.role_id is null or k.role_id=m.role_id) and not exists(select 1 from public.knowledge_conflicts c where c.organization_id=target_org and c.status='open' and c.conflict_type='conflict' and k.id in(c.knowledge_chunk_a,c.knowledge_chunk_b)) and public.knowledge_scope_match(k.scope,jsonb_build_object('channels',jsonb_build_array('employee'),'roles',coalesce((select jsonb_build_array(r.id::text,r.name) from public.roles r where r.id=m.role_id and r.organization_id=target_org),'[]'::jsonb)))='matches',false))) eligible;
 select count(distinct user_id) into updates from public.training_assignments where organization_id=target_org and retired_at is null and update_required;
 select count(*) into attention from public.knowledge_test_cases where organization_id=target_org and connection_id is not null and retired_at is null and (case when agent_response_required then last_agent_result else last_result end)->>'trainingStatus' in('failed','review','knowledge_gap');
 return jsonb_build_object('peopleReady',ready,'peopleUpdates',updates,'agentAttention',attention);
end $$;
revoke all on function public.training_operational_summary(uuid) from public,anon;grant execute on function public.training_operational_summary(uuid) to authenticated;
-- A training assignment is not an access grant. Revoked knowledge cannot leak through scenario excerpts.
drop policy scenario_read on public.training_scenarios;
create policy scenario_read on public.training_scenarios for select to authenticated using(public.is_org_admin(organization_id) or (status='approved' and exists(select 1 from public.training_assignments a join public.knowledge_chunks k on k.id=a.knowledge_chunk_id and k.organization_id=a.organization_id join public.organization_members m on m.user_id=a.user_id and m.organization_id=a.organization_id left join public.roles r on r.id=m.role_id and r.organization_id=m.organization_id where a.organization_id=training_scenarios.organization_id and a.knowledge_chunk_id=training_scenarios.knowledge_chunk_id and a.user_id=auth.uid() and a.retired_at is null and k.approved and k.library_archived_at is null and k.health_status='healthy' and (k.role_id is null or k.role_id=m.role_id) and public.knowledge_scope_match(k.scope,jsonb_build_object('channels',jsonb_build_array('employee'),'roles',case when r.id is null then '[]'::jsonb else jsonb_build_array(r.id::text,r.name) end))='matches')));

-- Changes in scopes or source grants are also agent configuration changes.
create function public.training_agent_access_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;connection uuid;
begin
 if tg_op='DELETE' then org:=old.organization_id;connection:=old.connection_id;else org:=new.organization_id;connection:=new.connection_id;end if;
 update public.external_ai_connections set configuration_version=configuration_version+1 where id=connection and organization_id=org;
 update public.knowledge_test_cases set needs_rerun=true,agent_response_needs_update=agent_response_required where organization_id=org and connection_id=connection;
 insert into public.training_events(organization_id,event_type,actor_id,entity_id) values(org,'agent_permission_changed',auth.uid(),connection);
 return null;
end $$;
create trigger training_agent_scopes_changed after insert or update or delete on public.external_ai_scopes for each row execute function public.training_agent_access_changed();
create trigger training_agent_sources_changed after insert or update or delete on public.external_ai_knowledge_access for each row execute function public.training_agent_access_changed();

create function public.set_training_agent_behavior(target_org uuid,target_connection uuid,expected_version integer,rules_value text) returns integer language plpgsql security definer set search_path='' as $$
declare c public.external_ai_connections;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into c from public.external_ai_connections where id=target_connection and organization_id=target_org for update;
 if c.id is null or c.configuration_version<>expected_version then raise exception 'Agent configuration changed' using errcode='40001';end if;
 if length(trim(rules_value)) not between 10 and 4000 then raise exception 'Add behavior rules';end if;
 update public.external_ai_connections set behavior_rules=rules_value where id=c.id returning * into c;
 return c.configuration_version;
end $$;
revoke all on function public.set_training_agent_behavior(uuid,uuid,integer,text) from public,anon;grant execute on function public.set_training_agent_behavior(uuid,uuid,integer,text) to authenticated;
create function public.training_accessible_knowledge(target_org uuid,knowledge_ids uuid[]) returns table(id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_org_member(target_org) or coalesce(array_length(knowledge_ids,1),0)>100 then raise exception 'Workspace training access required' using errcode='42501';end if;
 return query select k.id from public.knowledge_chunks k join public.organization_members m on m.organization_id=k.organization_id and m.user_id=auth.uid() left join public.roles r on r.id=m.role_id and r.organization_id=m.organization_id
 where k.organization_id=target_org and k.id=any(knowledge_ids) and k.approved and k.library_archived_at is null and k.health_status='healthy' and (k.role_id is null or k.role_id=m.role_id or m.permission_level in('owner','admin'))
 and public.knowledge_scope_match(k.scope,jsonb_build_object('channels',jsonb_build_array('employee'),'roles',case when r.id is null then '[]'::jsonb else jsonb_build_array(r.id::text,r.name) end))='matches'
 and not exists(select 1 from public.knowledge_conflicts c where c.organization_id=target_org and c.status='open' and c.conflict_type='conflict' and k.id in(c.knowledge_chunk_a,c.knowledge_chunk_b));
end $$;
revoke all on function public.training_accessible_knowledge(uuid,uuid[]) from public,anon;grant execute on function public.training_accessible_knowledge(uuid,uuid[]) to authenticated;

-- Reserve request budget before model work, including failed attempts. No content is logged.
create table public.training_request_budgets(
 organization_id uuid not null references public.organizations(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,
 window_start timestamptz not null,requests integer not null default 1,primary key(organization_id,user_id)
);
alter table public.training_request_budgets enable row level security;
revoke all on public.training_request_budgets from public,anon,authenticated;grant all on public.training_request_budgets to service_role;
create function public.consume_training_budget(target_org uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or not public.is_org_member(target_org) then raise exception 'Workspace access required' using errcode='42501';end if;
 insert into public.training_request_budgets(organization_id,user_id,window_start) values(target_org,auth.uid(),now()) on conflict(organization_id,user_id) do update set window_start=case when training_request_budgets.window_start<now()-interval '1 minute' then now() else training_request_budgets.window_start end,requests=case when training_request_budgets.window_start<now()-interval '1 minute' then 1 else training_request_budgets.requests+1 end returning requests into n;
 return n<=10;
end $$;
revoke all on function public.consume_training_budget(uuid) from public,anon;grant execute on function public.consume_training_budget(uuid) to authenticated;

create function public.notify_training_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.update_required and new.retired_at is null and (not old.update_required or old.required_version is distinct from new.required_version) then
 insert into public.notifications(organization_id,user_id,type,title,body,link)
 select new.organization_id,new.user_id,'training_update','Your role guidance changed','Review the changed guidance and complete any required practice.','/app/training?view=mine#assignment-'||new.id::text
 where not exists(select 1 from public.notifications n where n.organization_id=new.organization_id and n.user_id=new.user_id and n.type='training_update' and not n.read and n.link='/app/training?view=mine#assignment-'||new.id::text);
 end if;
 if not new.update_required and old.update_required then update public.notifications set read=true where organization_id=new.organization_id and user_id=new.user_id and type='training_update' and link='/app/training?view=mine#assignment-'||new.id::text;end if;
 return new;
end $$;
create trigger notify_training_change after update on public.training_assignments for each row execute function public.notify_training_change();
create function public.version_training_test() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.question,new.context,new.consumer,new.connection_id,new.expected_behavior,new.expected_outcome,new.expected_knowledge_ids) is distinct from (old.question,old.context,old.consumer,old.connection_id,old.expected_behavior,old.expected_outcome,old.expected_knowledge_ids) then new.evaluation_version:=old.evaluation_version+1;new.needs_rerun:=true;new.agent_response_needs_update:=new.agent_response_required;end if;
 return new;
end $$;
create trigger version_training_test before update on public.knowledge_test_cases for each row execute function public.version_training_test();
-- External agents may submit observable answers for evaluation, with a separate opt-in write scope.
alter table public.external_ai_scopes drop constraint if exists external_ai_scopes_scope_check;
alter table public.external_ai_scopes add constraint external_ai_scopes_scope_check check(scope in('knowledge:read','processes:read','policies:read','sources:read','escalations:create','evaluations:create'));
create unique index training_submission_idempotency on public.agent_evaluation_runs(connection_id,submission_id) where submission_id is not null;
create function public.submit_agent_training_response(target_org uuid,target_connection uuid,target_key uuid,target_test uuid,request_id uuid,response_value jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.knowledge_test_cases;c public.external_ai_connections;r uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'External evaluation service required' using errcode='42501';end if;
 select * into c from public.external_ai_connections where organization_id=target_org and id=target_connection and status='active' for share;
 select * into t from public.knowledge_test_cases where organization_id=target_org and connection_id=target_connection and id=target_test and retired_at is null for share;
 if c.id is null or t.id is null or not exists(select 1 from public.external_ai_api_keys where id=target_key and organization_id=target_org and connection_id=c.id and revoked_at is null) or not exists(select 1 from public.external_ai_scopes where organization_id=target_org and connection_id=c.id and scope='evaluations:create') or not exists(select 1 from public.external_ai_scopes where organization_id=target_org and connection_id=c.id and scope='knowledge:read') then raise exception 'Agent evaluation access required' using errcode='42501';end if;
 if request_id is null or jsonb_typeof(response_value)<>'object' or char_length(response_value->>'answer') not between 1 and 12000 or jsonb_typeof(response_value->'sources')<>'array' or jsonb_array_length(response_value->'sources')>20 then raise exception 'Invalid observable response' using errcode='22023';end if;
 select id into r from public.agent_evaluation_runs where organization_id=target_org and connection_id=c.id and submission_id=request_id;
 if r is not null then return r;end if;
 insert into public.agent_evaluation_runs(organization_id,test_id,connection_id,evaluation_version,configuration_version,execution_mode,submitted_response,submission_id,origin_api_key_id)
 values(target_org,t.id,c.id,t.evaluation_version,c.configuration_version,'agent_response',response_value,request_id,target_key) returning id into r;
 update public.knowledge_test_cases set needs_rerun=true,agent_response_required=true,agent_response_needs_update=true where id=t.id;
 return r;
end $$;
revoke all on function public.submit_agent_training_response(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;grant execute on function public.submit_agent_training_response(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

-- Disconnect access atomically while retaining approval, source and evaluation history.
create function public.disconnect_training_agent(target_org uuid,target_connection uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 update public.external_ai_connections set status='paused' where organization_id=target_org and id=target_connection;
 if not found then raise exception 'Connection not found' using errcode='P0002';end if;
 update public.external_ai_api_keys set revoked_at=coalesce(revoked_at,now()) where organization_id=target_org and connection_id=target_connection;
 insert into public.training_events(organization_id,event_type,actor_id,metadata) values(target_org,'agent_disconnected',auth.uid(),jsonb_build_object('connectionId',target_connection));
end $$;
revoke all on function public.disconnect_training_agent(uuid,uuid) from public,anon;grant execute on function public.disconnect_training_agent(uuid,uuid) to authenticated;

-- Settings, scopes and grants commit together; a failed replacement restores the prior configuration.
create function public.update_training_agent_connection(target_org uuid,target_connection uuid,settings_value jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c public.external_ai_connections;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501';end if;
 select * into c from public.external_ai_connections where organization_id=target_org and id=target_connection for update;
 if c.id is null then raise exception 'Connection not found' using errcode='P0002';end if;
 update public.external_ai_connections set name=coalesce(settings_value->>'name',name),description=coalesce(settings_value->>'description',description),status=coalesce(settings_value->>'status',status),knowledge_mode=coalesce(settings_value->>'knowledgeMode',knowledge_mode) where id=c.id and organization_id=target_org;
 if settings_value ? 'scopes' then
 delete from public.external_ai_scopes where organization_id=target_org and connection_id=c.id;
 insert into public.external_ai_scopes(organization_id,connection_id,scope) select target_org,c.id,value from jsonb_array_elements_text(settings_value->'scopes');
 end if;
 if settings_value ? 'access' then
 delete from public.external_ai_knowledge_access where organization_id=target_org and connection_id=c.id;
 insert into public.external_ai_knowledge_access(organization_id,connection_id,source_type,source_id) select target_org,c.id,value->>'sourceType',nullif(value->>'sourceId','')::uuid from jsonb_array_elements(settings_value->'access');
 end if;
 insert into public.training_events(organization_id,event_type,actor_id,metadata) values(target_org,'agent_permissions_changed',auth.uid(),jsonb_build_object('connectionId',c.id));
end $$;
revoke all on function public.update_training_agent_connection(uuid,uuid,jsonb) from public,anon;grant execute on function public.update_training_agent_connection(uuid,uuid,jsonb) to authenticated;
-- Poll only this authenticated connection's results. Changed permissions redact old evidence.
create function public.read_agent_training_run(target_org uuid,target_connection uuid,target_key uuid,target_run uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.agent_evaluation_runs;c public.external_ai_connections;t public.knowledge_test_cases;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Evaluation service required' using errcode='42501';end if;
 select * into c from public.external_ai_connections where id=target_connection and organization_id=target_org and status='active';
 if c.id is null or not exists(select 1 from public.external_ai_api_keys where id=target_key and organization_id=target_org and connection_id=c.id and revoked_at is null) or not exists(select 1 from public.external_ai_scopes where organization_id=target_org and connection_id=c.id and scope='evaluations:create') or not exists(select 1 from public.external_ai_scopes where organization_id=target_org and connection_id=c.id and scope='knowledge:read') then raise exception 'Evaluation access required' using errcode='42501';end if;
 select * into r from public.agent_evaluation_runs where organization_id=target_org and connection_id=c.id and id=target_run;
 if r.id is null then return null;end if;
 select * into t from public.knowledge_test_cases where organization_id=target_org and id=r.test_id;
 if r.configuration_version<>c.configuration_version or r.evaluation_version<>t.evaluation_version or t.retired_at is not null or exists(select 1 from jsonb_array_elements(coalesce(r.result->'sources','[]')) s left join public.knowledge_chunks k on k.id=(s->>'id')::uuid and k.organization_id=target_org where k.id is null or not k.approved or k.library_archived_at is not null or k.current_version<>(s->>'version')::integer) then return jsonb_build_object('run_id',r.id,'status','superseded','error','Knowledge, test definition or permissions changed; submit a fresh response.');end if;
 return jsonb_build_object('run_id',r.id,'status',r.status,'execution_mode',r.execution_mode,'result',r.result,'error_code',r.error_code,'evaluation_version',r.evaluation_version,'configuration_version',r.configuration_version);
end $$;
revoke all on function public.read_agent_training_run(uuid,uuid,uuid,uuid) from public,anon,authenticated;grant execute on function public.read_agent_training_run(uuid,uuid,uuid,uuid) to service_role;
