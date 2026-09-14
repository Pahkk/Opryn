alter table public.organization_settings
  add column if not exists estimated_interruption_minutes numeric not null default 3
    check (estimated_interruption_minutes between 0.5 and 30),
  add column if not exists expert_answers_require_admin_approval boolean not null default true;

alter table public.knowledge_chunks
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists source_modified_at timestamptz,
  add column if not exists criticality text not null default 'normal'
    check (criticality in ('normal', 'critical')),
  add column if not exists health_status text not null default 'healthy'
    check (health_status in ('healthy', 'needs_review', 'conflict')),
  add column if not exists usage_count integer not null default 0 check (usage_count >= 0),
  add column if not exists employee_usage_count integer not null default 0 check (employee_usage_count >= 0),
  add column if not exists agent_usage_count integer not null default 0 check (agent_usage_count >= 0),
  add column if not exists last_used_at timestamptz,
  add column if not exists current_version integer not null default 1 check (current_version > 0);

update public.knowledge_chunks
set last_confirmed_at = coalesce(last_confirmed_at, created_at)
where approved = true and last_confirmed_at is null;

create table public.question_clusters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  topic text not null check (char_length(topic) between 1 and 240),
  representative_question text not null check (char_length(representative_question) between 1 and 4000),
  embedding extensions.vector(1536),
  question_count integer not null default 1 check (question_count > 0),
  employee_count integer not null default 0 check (employee_count >= 0),
  agent_count integer not null default 0 check (agent_count >= 0),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_questions
  add column if not exists cluster_id uuid references public.question_clusters(id) on delete set null,
  add column if not exists assigned_expert_id uuid references public.profiles(id) on delete set null,
  add column if not exists conversation_id uuid,
  add column if not exists conversation_context jsonb not null default '[]'::jsonb,
  add column if not exists origin text not null default 'employee'
    check (origin in ('employee', 'external_ai'));

alter table public.external_ai_escalations
  add column if not exists cluster_id uuid references public.question_clusters(id) on delete set null;

alter table public.question_answers drop constraint if exists question_answers_answer_type_check;
alter table public.question_answers add constraint question_answers_answer_type_check
  check (answer_type in ('opryn', 'owner', 'expert'));

create table public.knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_chunk_id uuid not null references public.knowledge_chunks(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text,
  content text not null check (char_length(content) between 1 and 20000),
  changed_by uuid references public.profiles(id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (knowledge_chunk_id, version_number)
);

create table public.knowledge_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  question_id uuid not null references public.employee_questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('helpful', 'not_right')),
  reason text check (reason is null or reason in ('outdated', 'wrong_policy', 'missing_information', 'didnt_answer', 'other')),
  note text check (note is null or char_length(note) <= 2000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (question_id, user_id)
);

create table public.knowledge_experts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_chunk_id uuid references public.knowledge_chunks(id) on delete cascade,
  category text,
  user_id uuid not null references public.profiles(id) on delete cascade,
  priority integer not null default 1 check (priority between 1 and 100),
  can_approve boolean not null default false,
  created_at timestamptz not null default now(),
  check (knowledge_chunk_id is not null or nullif(trim(category), '') is not null),
  unique (organization_id, knowledge_chunk_id, category, user_id)
);

create table public.knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_chunk_a uuid not null references public.knowledge_chunks(id) on delete cascade,
  knowledge_chunk_b uuid not null references public.knowledge_chunks(id) on delete cascade,
  conflict_type text not null default 'conflict' check (conflict_type in ('conflict', 'possible_duplicate')),
  explanation text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (knowledge_chunk_a <> knowledge_chunk_b)
);

create table public.knowledge_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in (
    'question_asked', 'question_answered', 'question_unknown', 'question_clustered',
    'question_escalated', 'expert_answered', 'owner_answered', 'knowledge_suggested',
    'knowledge_approved', 'knowledge_rejected', 'knowledge_confirmed',
    'knowledge_updated', 'knowledge_conflict_detected', 'answer_feedback_positive',
    'answer_feedback_negative', 'agent_query', 'agent_unknown'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  question_id uuid references public.employee_questions(id) on delete set null,
  knowledge_chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index question_clusters_org_status_idx on public.question_clusters(organization_id, status, question_count desc);
create index question_clusters_embedding_idx on public.question_clusters using hnsw (embedding extensions.vector_cosine_ops);
create index employee_questions_cluster_idx on public.employee_questions(organization_id, cluster_id, created_at desc);
create index knowledge_feedback_org_status_idx on public.knowledge_feedback(organization_id, status, created_at desc);
create index knowledge_experts_org_item_idx on public.knowledge_experts(organization_id, knowledge_chunk_id, priority);
create unique index knowledge_experts_category_unique
  on public.knowledge_experts(organization_id, lower(category), user_id)
  where knowledge_chunk_id is null and category is not null;
create index knowledge_conflicts_org_status_idx on public.knowledge_conflicts(organization_id, status, created_at desc);
create index knowledge_events_org_type_idx on public.knowledge_events(organization_id, event_type, created_at desc);
create index knowledge_versions_item_idx on public.knowledge_versions(knowledge_chunk_id, version_number desc);

create trigger question_clusters_updated before update on public.question_clusters
for each row execute function public.set_updated_at();

alter table public.question_clusters enable row level security;
alter table public.knowledge_versions enable row level security;
alter table public.knowledge_feedback enable row level security;
alter table public.knowledge_experts enable row level security;
alter table public.knowledge_conflicts enable row level security;
alter table public.knowledge_events enable row level security;

create policy question_clusters_admin_all on public.question_clusters for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy questions_assigned_expert_read on public.employee_questions for select to authenticated
using (assigned_expert_id = (select auth.uid()) and public.is_org_member(organization_id));
create policy questions_assigned_expert_update on public.employee_questions for update to authenticated
using (assigned_expert_id = (select auth.uid()) and public.is_org_member(organization_id))
with check (assigned_expert_id = (select auth.uid()) and public.is_org_member(organization_id));

create policy answers_assigned_expert_read on public.question_answers for select to authenticated
using (exists (
  select 1 from public.employee_questions question
  where question.id = question_id
    and question.organization_id = organization_id
    and question.assigned_expert_id = (select auth.uid())
));
create policy answers_assigned_expert_insert on public.question_answers for insert to authenticated
with check (
  answer_type = 'expert'
  and answered_by = (select auth.uid())
  and exists (
    select 1 from public.employee_questions question
    where question.id = question_id
      and question.organization_id = organization_id
      and question.assigned_expert_id = (select auth.uid())
  )
);
create policy answers_assigned_expert_update on public.question_answers for update to authenticated
using (
  answered_by = (select auth.uid())
  and exists (
    select 1 from public.employee_questions question
    where question.id = question_id
      and question.organization_id = organization_id
      and question.assigned_expert_id = (select auth.uid())
  )
)
with check (
  answered_by = (select auth.uid())
  and answer_type = 'expert'
  and exists (
    select 1 from public.employee_questions question
    where question.id = question_id
      and question.organization_id = organization_id
      and question.assigned_expert_id = (select auth.uid())
  )
);

create policy knowledge_versions_read on public.knowledge_versions for select to authenticated
using (exists (
  select 1 from public.knowledge_chunks chunk
  where chunk.id = knowledge_chunk_id and chunk.organization_id = organization_id
));
create policy knowledge_versions_admin_all on public.knowledge_versions for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy knowledge_feedback_read on public.knowledge_feedback for select to authenticated
using (public.is_org_admin(organization_id) or user_id = (select auth.uid()));
create policy knowledge_feedback_member_insert on public.knowledge_feedback for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.employee_questions question
    where question.id = question_id
      and question.organization_id = organization_id
      and question.asked_by = (select auth.uid())
  )
);
create policy knowledge_feedback_admin_update on public.knowledge_feedback for update to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy knowledge_experts_read on public.knowledge_experts for select to authenticated
using (public.is_org_member(organization_id));
create policy knowledge_experts_admin_all on public.knowledge_experts for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy knowledge_conflicts_admin_all on public.knowledge_conflicts for all to authenticated
using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy knowledge_events_read on public.knowledge_events for select to authenticated
using (public.is_org_admin(organization_id) or actor_id = (select auth.uid()));
create policy knowledge_events_member_insert on public.knowledge_events for insert to authenticated
with check (public.is_org_member(organization_id) and (actor_id is null or actor_id = (select auth.uid())));

create or replace function public.record_question_cluster(
  target_organization_id uuid,
  question_text text,
  question_embedding extensions.vector(1536),
  question_origin text default 'employee'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  matched_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized';
  end if;
  if question_origin not in ('employee', 'external_ai') then
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
      organization_id, topic, representative_question, embedding,
      employee_count, agent_count
    ) values (
      target_organization_id,
      left(trim(question_text), 240),
      trim(question_text),
      question_embedding,
      case when question_origin = 'employee' then 1 else 0 end,
      case when question_origin = 'external_ai' then 1 else 0 end
    ) returning id into matched_id;
  else
    update public.question_clusters
    set question_count = question_count + 1,
        employee_count = employee_count + case when question_origin = 'employee' then 1 else 0 end,
        agent_count = agent_count + case when question_origin = 'external_ai' then 1 else 0 end
    where id = matched_id;
  end if;
  return matched_id;
end;
$$;

create or replace function public.find_question_cluster(
  target_organization_id uuid,
  question_embedding extensions.vector(1536)
)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare matched_id uuid;
begin
  if auth.role() <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized';
  end if;
  select cluster.id into matched_id
  from public.question_clusters cluster
  where cluster.organization_id = target_organization_id
    and cluster.status = 'open'
    and cluster.embedding is not null
    and 1 - (cluster.embedding operator(extensions.<=>) question_embedding) >= 0.84
  order by cluster.embedding operator(extensions.<=>) question_embedding
  limit 1;
  return matched_id;
end;
$$;

create or replace function public.record_knowledge_usage(
  target_organization_id uuid,
  target_chunk_ids uuid[],
  usage_origin text default 'employee'
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' and not public.is_org_member(target_organization_id) then
    raise exception 'Not authorized';
  end if;
  if usage_origin not in ('employee', 'external_ai') then
    raise exception 'Invalid usage origin';
  end if;
  update public.knowledge_chunks
  set usage_count = usage_count + 1,
      employee_usage_count = employee_usage_count + case when usage_origin = 'employee' then 1 else 0 end,
      agent_usage_count = agent_usage_count + case when usage_origin = 'external_ai' then 1 else 0 end,
      last_used_at = now()
  where organization_id = target_organization_id
    and approved = true
    and id = any(target_chunk_ids);
end;
$$;

revoke all on function public.record_question_cluster(uuid, text, extensions.vector, text) from public;
revoke all on function public.find_question_cluster(uuid, extensions.vector) from public;
revoke all on function public.record_knowledge_usage(uuid, uuid[], text) from public;
grant execute on function public.record_question_cluster(uuid, text, extensions.vector, text) to authenticated, service_role;
grant execute on function public.find_question_cluster(uuid, extensions.vector) to authenticated, service_role;
grant execute on function public.record_knowledge_usage(uuid, uuid[], text) to authenticated, service_role;

create or replace function public.notify_owners_of_question()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'needs_owner' and new.escalated = true
    and (tg_op = 'INSERT' or coalesce(old.escalated, false) = false) then
    if new.assigned_expert_id is not null then
      insert into public.notifications (organization_id, user_id, type, title, body, link)
      values (
        new.organization_id,
        new.assigned_expert_id,
        'expert_question',
        'Opryn matched a question to you',
        new.question,
        '/app/needs-you?view=questions'
      );
    else
      insert into public.notifications (organization_id, user_id, type, title, body, link)
      select
        new.organization_id,
        member.user_id,
        'owner_question',
        'A teammate needs your answer',
        new.question,
        '/app/needs-you?view=questions'
      from public.organization_members member
      where member.organization_id = new.organization_id
        and member.permission_level in ('owner', 'admin');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.escalate_my_question(target_question_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare target_org uuid;
begin
  update public.employee_questions
  set escalated = true
  where id = target_question_id
    and asked_by = auth.uid()
    and status = 'needs_owner'
    and escalated = false
  returning organization_id into target_org;
  if target_org is not null then
    insert into public.knowledge_events (
      organization_id, event_type, actor_id, question_id, metadata
    ) values (
      target_org, 'question_escalated', auth.uid(), target_question_id, '{}'::jsonb
    );
  end if;
  return target_org is not null;
end;
$$;

grant select, insert, update, delete on public.question_clusters to authenticated;
grant select, insert, update, delete on public.knowledge_versions to authenticated;
grant select, insert, update, delete on public.knowledge_feedback to authenticated;
grant select, insert, update, delete on public.knowledge_experts to authenticated;
grant select, insert, update, delete on public.knowledge_conflicts to authenticated;
grant select, insert, update, delete on public.knowledge_events to authenticated;

comment on table public.question_clusters is 'Organization-isolated semantic groups of repeated employee and external-agent questions.';
comment on table public.knowledge_feedback is 'Employee answer feedback requiring owner or expert review before approved knowledge changes.';
comment on table public.knowledge_versions is 'Immutable history for approved company knowledge.';
