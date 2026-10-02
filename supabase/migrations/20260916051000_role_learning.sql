-- Preserve existing training enum/API. New states describe evidence, not mastery.
alter table public.training_assignments
  add column learning_state text not null default 'not_started' check(learning_state in('not_started','viewed','acknowledged','practiced')),
  add column acknowledged_process_updated_at timestamptz,
  add column practiced_process_updated_at timestamptz,
  add column origin_role_id uuid references public.roles(id) on delete cascade,
  add constraint learning_origin_role_same_org foreign key(origin_role_id,organization_id) references public.roles(id,organization_id);
update public.training_assignments set learning_state=case when status in('started','completed') then 'viewed' else 'not_started' end;
-- Historical "completed" is not a current-version acknowledgement or assessment.
-- Legacy APIs remain supported; browsers cannot forge role origin/version evidence,
-- or use their self-update policy to change assignment ownership or process.
revoke update,insert on public.training_assignments from public,anon,authenticated;
grant update(status,started_at,completed_at) on public.training_assignments to authenticated;
grant insert(organization_id,user_id,process_id,status) on public.training_assignments to authenticated;
create table public.role_learning_requirements(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 role_id uuid not null,process_id uuid not null,
 created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),
 primary key(role_id,process_id),
 foreign key(role_id,organization_id) references public.roles(id,organization_id) on delete cascade,
 foreign key(process_id,organization_id) references public.processes(id,organization_id) on delete cascade
);
alter table public.role_learning_requirements enable row level security;
create policy learning_requirements_read on public.role_learning_requirements for select to authenticated
 using(public.is_org_admin(organization_id) or exists(select 1 from public.organization_members m where m.organization_id=role_learning_requirements.organization_id and m.role_id=role_learning_requirements.role_id and m.user_id=auth.uid()));
revoke all on public.role_learning_requirements from anon,authenticated;
grant select on public.role_learning_requirements to authenticated;grant all on public.role_learning_requirements to service_role;
create function public.assign_role_learning(target_org uuid,target_role uuid,process_ids uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare process_id_value uuid;assigned integer:=0;
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
 if not exists(select 1 from public.roles where id=target_role and organization_id=target_org) or coalesce(array_length(process_ids,1),0) not between 1 and 200 then raise exception 'Choose role and knowledge' using errcode='22023'; end if;
 foreach process_id_value in array process_ids loop
   if not exists(select 1 from public.processes where id=process_id_value and organization_id=target_org and status='approved' and library_archived_at is null) then raise exception 'Only approved workspace processes can be assigned' using errcode='42501'; end if;
   insert into public.role_learning_requirements(organization_id,role_id,process_id,created_by) values(target_org,target_role,process_id_value,auth.uid()) on conflict do nothing;
   insert into public.training_assignments(organization_id,user_id,process_id,origin_role_id)
     select target_org,m.user_id,process_id_value,target_role from public.organization_members m where m.organization_id=target_org and m.role_id=target_role
     on conflict(user_id,process_id) do nothing;
   assigned:=assigned+1;
 end loop;
 return assigned;
end $$;
revoke all on function public.assign_role_learning(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.assign_role_learning(uuid,uuid,uuid[]) to authenticated;
create function public.remove_role_learning(target_org uuid,target_role uuid,target_process uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.is_org_admin(target_org),false) then raise exception 'Administrator required' using errcode='42501'; end if;
 delete from public.role_learning_requirements where organization_id=target_org and role_id=target_role and process_id=target_process;
 delete from public.training_assignments where organization_id=target_org and origin_role_id=target_role and process_id=target_process;
 -- Independent/manual assignments are retained. Removing an assignment does not remove knowledge.
end $$;
revoke all on function public.remove_role_learning(uuid,uuid,uuid) from public,anon;
grant execute on function public.remove_role_learning(uuid,uuid,uuid) to authenticated;
create function public.sync_member_role_learning() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.training_assignments where organization_id=new.organization_id and user_id=new.user_id
   and origin_role_id is not null and origin_role_id is distinct from new.role_id;
 insert into public.training_assignments(organization_id,user_id,process_id,origin_role_id)
   select new.organization_id,new.user_id,r.process_id,r.role_id from public.role_learning_requirements r
   join public.processes p on p.id=r.process_id and p.organization_id=r.organization_id and p.status='approved' and p.library_archived_at is null
   where r.organization_id=new.organization_id and r.role_id=new.role_id on conflict(user_id,process_id) do nothing;
 return new;
end $$;
create trigger sync_member_role_learning after insert or update of role_id on public.organization_members
 for each row execute function public.sync_member_role_learning();
create function public.record_learning_activity(target_org uuid,target_process uuid,expected_updated timestamptz,activity text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.processes;a public.training_assignments;
begin
 if auth.uid() is null or not public.is_org_member(target_org) then raise exception 'Workspace access required' using errcode='42501'; end if;
 if activity not in('viewed','acknowledged','practiced') then raise exception 'Invalid learning activity' using errcode='22023'; end if;
 select * into p from public.processes where organization_id=target_org and id=target_process and status='approved' and library_archived_at is null for share;
 if not found then raise exception 'Approved guidance unavailable' using errcode='P0002'; end if;
 if p.updated_at is distinct from expected_updated then raise exception 'Guidance changed. Read the current version first.' using errcode='40001'; end if;
 select * into a from public.training_assignments where organization_id=target_org and process_id=p.id and user_id=auth.uid() for update;
 if not found then raise exception 'Learning not assigned' using errcode='42501'; end if;
 if exists(select 1 from public.knowledge_chunks k where k.organization_id=target_org and k.process_id=p.id and k.approved
   and (k.health_status in('conflict','needs_review') or exists(select 1 from public.knowledge_conflicts c where c.organization_id=target_org and c.status='open' and c.conflict_type='conflict' and k.id in(c.knowledge_chunk_a,c.knowledge_chunk_b)))) then raise exception 'Guidance needs review before learning' using errcode='23514'; end if;
 update public.training_assignments set
   status=case when activity='acknowledged' then 'completed'::public.training_status when status='assigned' then 'started'::public.training_status else status end,
   started_at=coalesce(started_at,now()),completed_at=case when activity='acknowledged' then now() else completed_at end,
   learning_state=case when activity='viewed' and learning_state<>'not_started' then learning_state else activity end,
   acknowledged_process_updated_at=case when activity='acknowledged' then p.updated_at else acknowledged_process_updated_at end,
   practiced_process_updated_at=case when activity='practiced' then p.updated_at else practiced_process_updated_at end
   where id=a.id returning * into a;
 return jsonb_build_object('state',a.learning_state,'acknowledgedVersion',a.acknowledged_process_updated_at,'practicedVersion',a.practiced_process_updated_at);
end $$;
revoke all on function public.record_learning_activity(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.record_learning_activity(uuid,uuid,timestamptz,text) to authenticated;
