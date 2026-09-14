create table public.organization_onboarding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  current_step text not null default 'goals' check (current_step in (
    'goals','knowledge','tools','connections','setup','teach','test','invite','complete'
  )),
  completed_steps text[] not null default '{}'::text[],
  selected_goals text[] not null default '{}'::text[],
  knowledge_locations text[] not null default '{}'::text[],
  selected_tools text[] not null default '{}'::text[],
  selected_ai_tools text[] not null default '{}'::text[],
  skipped_connections text[] not null default '{}'::text[],
  suggested_knowledge_areas text[] not null default '{}'::text[],
  first_question text,
  first_answer text,
  first_rule_id uuid references public.process_rules(id) on delete set null,
  first_knowledge_id uuid references public.knowledge_chunks(id) on delete set null,
  first_test_question text,
  first_test_answered boolean not null default false,
  team_invited boolean not null default false,
  onboarding_complete boolean not null default false,
  checklist_hidden boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'organization_created','goal_selected','knowledge_location_selected',
    'integration_selected','integration_connected','first_knowledge_created',
    'first_knowledge_approved','first_test_question','team_invited',
    'onboarding_completed','step_skipped'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index onboarding_events_org_created_idx
  on public.onboarding_events(organization_id, created_at desc);

create trigger organization_onboarding_updated
  before update on public.organization_onboarding
  for each row execute function public.set_updated_at();

alter table public.organization_onboarding enable row level security;
alter table public.onboarding_events enable row level security;

create policy organization_onboarding_admin_read
  on public.organization_onboarding for select to authenticated
  using (public.is_org_admin(organization_id));
create policy organization_onboarding_admin_all
  on public.organization_onboarding for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy onboarding_events_admin_read
  on public.onboarding_events for select to authenticated
  using (public.is_org_admin(organization_id));
create policy onboarding_events_admin_insert
  on public.onboarding_events for insert to authenticated
  with check (public.is_org_admin(organization_id) and user_id = (select auth.uid()));

grant select, insert, update, delete on public.organization_onboarding to authenticated;
grant select, insert on public.onboarding_events to authenticated;

alter table public.communication_oauth_states
  add column if not exists return_to text;

comment on table public.organization_onboarding is
  'Resumable, organization-scoped setup state for the guided Opryn owner onboarding flow.';
comment on table public.onboarding_events is
  'Private activation funnel events used to improve Opryn onboarding without exposing technical event names to users.';

create or replace function public.create_guided_organization(
  business_name text,
  business_industry text,
  business_employee_count integer,
  owner_job_title text,
  suggested_areas text[] default '{}'::text[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(trim(business_name), '') is null then raise exception 'Business name is required'; end if;
  if nullif(trim(business_industry), '') is null then raise exception 'Industry is required'; end if;
  if business_employee_count < 0 or business_employee_count > 100000 then raise exception 'Invalid employee count'; end if;

  insert into public.profiles (id, full_name, email, avatar_url)
  select users.id,
    coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
    coalesce(users.email, ''), users.raw_user_meta_data ->> 'avatar_url'
  from auth.users as users where users.id = auth.uid()
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  insert into public.organizations (name, industry, employee_count, created_by)
  values (trim(business_name), trim(business_industry), business_employee_count, auth.uid())
  returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, permission_level, owner_role)
  values (new_org_id, auth.uid(), 'owner', nullif(trim(owner_job_title), ''));
  insert into public.organization_settings (organization_id) values (new_org_id);
  insert into public.organization_discovery (
    organization_id, business_description, repeated_work, hardest_to_handoff,
    common_questions, owner_goal, created_by
  ) values (
    new_org_id,
    trim(business_name) || ' is a ' || trim(business_industry) || ' business.',
    'Day-to-day work the owner wants the team to handle consistently.',
    'Important work and decisions that still depend on the owner.',
    '', '', auth.uid()
  );
  insert into public.organization_onboarding (
    organization_id, current_step, completed_steps, suggested_knowledge_areas, created_by
  ) values (new_org_id, 'goals', array['business'], coalesce(suggested_areas, '{}'::text[]), auth.uid());
  return new_org_id;
end;
$$;

revoke all on function public.create_guided_organization(text, text, integer, text, text[]) from public;
grant execute on function public.create_guided_organization(text, text, integer, text, text[]) to authenticated;
