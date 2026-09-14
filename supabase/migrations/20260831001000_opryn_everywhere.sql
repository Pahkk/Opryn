create table public.communication_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams')),
  external_workspace_id text not null,
  external_workspace_name text not null default '',
  bot_user_id text,
  encrypted_credentials text,
  status text not null default 'active' check (status in ('active', 'paused', 'disconnected')),
  settings jsonb not null default '{"allow_direct_messages":true,"allow_mentions":true,"access_mode":"all_members","escalation_destination":"opryn"}'::jsonb,
  installed_by uuid references public.profiles(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_workspace_id),
  unique (organization_id, provider)
);

create table public.communication_user_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.communication_integrations(id) on delete cascade,
  provider_user_id text not null,
  opryn_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (integration_id, provider_user_id),
  unique (integration_id, opryn_user_id)
);

create table public.communication_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.communication_integrations(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams')),
  provider_conversation_id text not null,
  opryn_user_id uuid not null references public.profiles(id) on delete cascade,
  context_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_id, provider_conversation_id, opryn_user_id)
);

create table public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.communication_integrations(id) on delete cascade,
  conversation_id uuid not null references public.communication_conversations(id) on delete cascade,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  content text not null check (char_length(content) between 1 and 12000),
  result_type text check (result_type is null or result_type in ('answered', 'unknown', 'link_required', 'denied', 'error', 'feedback', 'escalated')),
  question_id uuid references public.employee_questions(id) on delete set null,
  knowledge_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (integration_id, provider_message_id, direction)
);

create table public.communication_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  integration_id uuid references public.communication_integrations(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams')),
  provider_event_id text not null,
  provider_workspace_id text not null,
  provider_user_id text not null,
  provider_conversation_id text not null,
  provider_thread_id text not null,
  provider_message_id text not null,
  message_text text not null check (char_length(message_text) between 1 and 4000),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'ignored')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.communication_link_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.communication_integrations(id) on delete cascade,
  provider_user_id text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.communication_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('slack', 'teams')),
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.communication_rate_limits (
  integration_id uuid not null references public.communication_integrations(id) on delete cascade,
  provider_user_id text not null,
  minute_window timestamptz not null,
  minute_count integer not null default 0,
  hour_window timestamptz not null,
  hour_count integer not null default 0,
  primary key (integration_id, provider_user_id)
);

create table public.communication_chat_state (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.communication_chat_subscriptions (
  thread_id text primary key,
  created_at timestamptz not null default now()
);

create table public.communication_chat_locks (
  thread_id text primary key,
  token text not null,
  expires_at timestamptz not null
);

create table public.communication_chat_queues (
  thread_id text primary key,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index communication_integrations_org_idx on public.communication_integrations(organization_id, provider, status);
create index communication_mappings_user_idx on public.communication_user_mappings(organization_id, opryn_user_id);
create index communication_conversations_user_idx on public.communication_conversations(organization_id, opryn_user_id, updated_at desc);
create index communication_messages_conversation_idx on public.communication_messages(conversation_id, created_at desc);
create index communication_jobs_pending_idx on public.communication_jobs(status, next_attempt_at, created_at);
create index communication_links_expiry_idx on public.communication_link_tokens(expires_at) where used_at is null;
create index communication_oauth_expiry_idx on public.communication_oauth_states(expires_at) where consumed_at is null;

create trigger communication_integrations_updated before update on public.communication_integrations
for each row execute function public.set_updated_at();
create trigger communication_conversations_updated before update on public.communication_conversations
for each row execute function public.set_updated_at();

alter table public.employee_questions drop constraint if exists employee_questions_origin_check;
alter table public.employee_questions add constraint employee_questions_origin_check
  check (origin in ('employee', 'external_ai', 'slack', 'teams'));

create or replace function public.record_question_cluster(
  target_organization_id uuid,
  question_text text,
  question_embedding extensions.vector(1536),
  question_origin text default 'employee'
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare matched_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized';
  end if;
  if question_origin not in ('employee', 'external_ai', 'slack', 'teams') then
    raise exception 'Invalid question origin';
  end if;
  select cluster.id into matched_id
  from public.question_clusters cluster
  where cluster.organization_id = target_organization_id
    and cluster.status = 'open'
    and cluster.embedding is not null
    and 1 - (cluster.embedding operator(extensions.<=>) question_embedding) >= 0.84
  order by cluster.embedding operator(extensions.<=>) question_embedding
  limit 1;
  if matched_id is null then
    insert into public.question_clusters (
      organization_id, topic, representative_question, embedding, employee_count, agent_count
    ) values (
      target_organization_id, left(trim(question_text), 240), trim(question_text), question_embedding,
      case when question_origin in ('employee', 'slack', 'teams') then 1 else 0 end,
      case when question_origin = 'external_ai' then 1 else 0 end
    ) returning id into matched_id;
  else
    update public.question_clusters
    set question_count = question_count + 1,
        employee_count = employee_count + case when question_origin in ('employee', 'slack', 'teams') then 1 else 0 end,
        agent_count = agent_count + case when question_origin = 'external_ai' then 1 else 0 end
    where id = matched_id;
  end if;
  return matched_id;
end;
$$;

alter table public.communication_integrations enable row level security;
alter table public.communication_user_mappings enable row level security;
alter table public.communication_conversations enable row level security;
alter table public.communication_messages enable row level security;
alter table public.communication_jobs enable row level security;
alter table public.communication_link_tokens enable row level security;
alter table public.communication_oauth_states enable row level security;
alter table public.communication_rate_limits enable row level security;
alter table public.communication_chat_state enable row level security;
alter table public.communication_chat_subscriptions enable row level security;
alter table public.communication_chat_locks enable row level security;
alter table public.communication_chat_queues enable row level security;

create policy communication_integrations_member_read on public.communication_integrations for select to authenticated
using (public.is_org_member(organization_id));
create policy communication_integrations_admin_all on public.communication_integrations for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy communication_mappings_read on public.communication_user_mappings for select to authenticated
using (public.is_org_admin(organization_id) or opryn_user_id = (select auth.uid()));
create policy communication_mappings_admin_all on public.communication_user_mappings for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy communication_conversations_read on public.communication_conversations for select to authenticated
using (public.is_org_admin(organization_id) or opryn_user_id = (select auth.uid()));
create policy communication_messages_read on public.communication_messages for select to authenticated
using (exists (
  select 1 from public.communication_conversations conversation
  where conversation.id = conversation_id
    and conversation.organization_id = organization_id
    and (public.is_org_admin(organization_id) or conversation.opryn_user_id = (select auth.uid()))
));

create policy communication_links_user_read on public.communication_link_tokens for select to authenticated
using (public.is_org_member(organization_id));
create policy communication_oauth_admin_read on public.communication_oauth_states for select to authenticated
using (public.is_org_admin(organization_id));

create or replace function public.consume_communication_rate_limit(
  target_integration_id uuid,
  target_provider_user_id text,
  minute_limit integer default 20,
  hour_limit integer default 300
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  now_value timestamptz := now();
  minute_start timestamptz := date_trunc('minute', now_value);
  hour_start timestamptz := date_trunc('hour', now_value);
  current_row public.communication_rate_limits;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  insert into public.communication_rate_limits as limits (
    integration_id, provider_user_id, minute_window, minute_count, hour_window, hour_count
  ) values (target_integration_id, target_provider_user_id, minute_start, 1, hour_start, 1)
  on conflict (integration_id, provider_user_id) do update set
    minute_count = case when limits.minute_window = minute_start then limits.minute_count + 1 else 1 end,
    minute_window = minute_start,
    hour_count = case when limits.hour_window = hour_start then limits.hour_count + 1 else 1 end,
    hour_window = hour_start
  returning * into current_row;
  return current_row.minute_count <= minute_limit and current_row.hour_count <= hour_limit;
end;
$$;

create or replace function public.communication_state_set_if_absent(
  target_key text, target_value jsonb, target_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  delete from public.communication_chat_state where key = target_key and expires_at is not null and expires_at <= now();
  insert into public.communication_chat_state(key, value, expires_at)
  values (target_key, target_value, target_expires_at)
  on conflict (key) do nothing;
  return found;
end;
$$;

create or replace function public.communication_acquire_lock(
  target_thread_id text, target_token text, target_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  delete from public.communication_chat_locks where thread_id = target_thread_id and expires_at <= now();
  insert into public.communication_chat_locks(thread_id, token, expires_at)
  values (target_thread_id, target_token, target_expires_at)
  on conflict (thread_id) do nothing;
  return found;
end;
$$;

create or replace function public.communication_extend_lock(
  target_thread_id text, target_token text, target_expires_at timestamptz
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  update public.communication_chat_locks set expires_at = target_expires_at
  where thread_id = target_thread_id and token = target_token and expires_at > now();
  return found;
end;
$$;

create or replace function public.communication_release_lock(target_thread_id text, target_token text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorized'; end if;
  delete from public.communication_chat_locks where thread_id = target_thread_id and token = target_token;
end;
$$;

revoke all on function public.consume_communication_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.communication_state_set_if_absent(text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.communication_acquire_lock(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.communication_extend_lock(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.communication_release_lock(text, text) from public, anon, authenticated;
grant execute on function public.consume_communication_rate_limit(uuid, text, integer, integer) to service_role;
grant execute on function public.communication_state_set_if_absent(text, jsonb, timestamptz) to service_role;
grant execute on function public.communication_acquire_lock(text, text, timestamptz) to service_role;
grant execute on function public.communication_extend_lock(text, text, timestamptz) to service_role;
grant execute on function public.communication_release_lock(text, text) to service_role;
