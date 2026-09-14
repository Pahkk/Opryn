alter table public.external_learning_jobs add column last_requested_at timestamptz not null default now();
create table public.onboarding_learning_sessions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  intent jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.onboarding_learning_sessions enable row level security;
create policy onboarding_learning_own on public.onboarding_learning_sessions
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_org_admin(organization_id))
  with check (user_id = (select auth.uid()) and public.is_org_admin(organization_id));
grant select, insert, update on public.onboarding_learning_sessions to authenticated;
alter table public.onboarding_events drop constraint if exists onboarding_events_event_type_check;
alter table public.onboarding_events add constraint onboarding_events_event_type_check check (event_type in (
  'organization_created','goal_selected','knowledge_location_selected','integration_selected','integration_connected',
  'first_knowledge_created','first_knowledge_approved','first_test_question','team_invited','onboarding_completed',
  'step_skipped','learning_started','learning_completed','knowledge_detected','learning_source_opened',
  'learning_type_selected','external_ai_learn_started','external_ai_context_received','learning_processing_started',
  'learning_processing_completed','learning_review_opened','first_external_ai_learn_completed','first_suggested_question_used'
));
