-- Additive workspace-wide learning limit. No knowledge or billing rewrite.
create table if not exists public.ai_learning_rate_limits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  minute_window timestamptz not null,
  minute_count integer not null,
  hour_window timestamptz not null,
  hour_count integer not null
);
alter table public.ai_learning_rate_limits enable row level security;
revoke all on public.ai_learning_rate_limits from public, anon, authenticated;
create or replace function public.consume_ai_learning_rate_limit(workspace_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  hour_start timestamptz := date_trunc('hour', now());
  counts public.ai_learning_rate_limits;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Not authorized'; end if;
  insert into public.ai_learning_rate_limits as limits values (workspace_id, minute_start, 1, hour_start, 1)
  on conflict (organization_id) do update set
    minute_count = case when limits.minute_window = minute_start then limits.minute_count + 1 else 1 end,
    minute_window = minute_start,
    hour_count = case when limits.hour_window = hour_start then limits.hour_count + 1 else 1 end,
    hour_window = hour_start
  returning * into counts;
  return counts.minute_count <= 5 and counts.hour_count <= 25;
end;
$$;
revoke all on function public.consume_ai_learning_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_learning_rate_limit(uuid) to service_role;
-- Rollback: stop new learning submissions before removing function/table.
