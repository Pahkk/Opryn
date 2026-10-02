-- Additive: old jobs are unchanged. Apply only to a reviewed nonproduction
-- database first. No automatic approval or source/content rewrite.
alter table public.external_learning_jobs
  add column if not exists learning_request_id uuid;
create unique index if not exists external_learning_jobs_request_once_idx
  on public.external_learning_jobs (organization_id, created_by, learning_request_id)
  where learning_request_id is not null;
comment on column public.external_learning_jobs.learning_request_id is
  'Opaque server-issued onboarding handoff reference, validated against the authenticated pending session. Not an authentication token.';
-- Rollback: stop correlated handoffs first, then drop the index and column.
-- Historical jobs and human-reviewed knowledge are not deleted.
