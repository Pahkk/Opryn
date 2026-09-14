alter table public.organization_onboarding
  add column if not exists current_view text;

update public.organization_onboarding
set current_view = current_step
where current_view is null;

alter table public.organization_onboarding
  alter column current_view set default 'goals',
  alter column current_view set not null;

comment on column public.organization_onboarding.current_view is
  'The precise onboarding screen to resume, including guided substeps within a main step.';
