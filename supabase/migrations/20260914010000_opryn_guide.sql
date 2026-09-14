-- Optional AI question budget. Guide navigation works without this migration.
-- One bounded row per membership. No questions, messages or product data stored.
create table public.guide_question_limits (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null,
  primary key (organization_id, user_id)
);
alter table public.guide_question_limits enable row level security;
revoke all on public.guide_question_limits from public, anon, authenticated;

create or replace function public.consume_guide_question_limit(target_organization_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  current_window timestamptz := date_trunc('hour', now());
  next_count integer;
begin
  if caller is null or not exists (
    select 1 from public.organization_members where organization_id = target_organization_id and user_id = caller
  ) then return false; end if;
  insert into public.guide_question_limits as limits (organization_id, user_id, window_start, request_count)
  values (target_organization_id, caller, current_window, 1)
  on conflict (organization_id, user_id) do update set
    window_start = excluded.window_start,
    request_count = case when limits.window_start = excluded.window_start then least(limits.request_count + 1, 61) else 1 end
  returning request_count into next_count;
  return next_count <= 60;
end;
$$;
revoke all on function public.consume_guide_question_limit(uuid) from public, anon;
grant execute on function public.consume_guide_question_limit(uuid) to authenticated;
