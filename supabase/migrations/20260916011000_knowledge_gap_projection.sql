-- question_clusters remains the gap identity and semantic deduplication store.
alter table public.question_clusters
  add column if not exists classification text not null default 'missing_answer'
    check (classification in ('missing_answer','clarification_needed','conflict','outdated',
      'one_time_exception','new_policy_needed','new_process_needed')),
  add column if not exists resolved_by_knowledge_id uuid references public.knowledge_chunks(id) on delete set null;

-- Existing table RLS applies to every relation read by this view.
create or replace view public.company_knowledge_gaps with (security_invoker=true) as
select c.id,c.organization_id,c.topic,c.representative_question,c.classification,
  lower(regexp_replace(trim(c.representative_question),'[[:space:]]+',' ','g')) as normalized_question,
  c.question_count,c.created_at as first_seen_at,c.updated_at as last_seen_at,c.resolved_by_knowledge_id,
  case when c.status='dismissed' then 'dismissed'
    when c.status='resolved' then 'resolved'
    when exists(select 1 from public.employee_questions q join public.knowledge_proposals p
      on p.related_question_id=q.id and p.organization_id=q.organization_id
      where q.cluster_id=c.id and q.organization_id=c.organization_id
        and p.status in ('pending_approval','needs_review')) then 'proposed'
    when exists(select 1 from public.employee_questions q where q.cluster_id=c.id
      and q.organization_id=c.organization_id and q.status='needs_owner' and q.escalated=true) then 'routed'
    when exists(select 1 from public.employee_questions q join public.question_answers a
      on a.question_id=q.id and a.organization_id=q.organization_id
      where q.cluster_id=c.id and q.organization_id=c.organization_id and a.answer_type in ('owner','expert')) then 'answered'
    else 'open' end as status,
  (select count(distinct q.origin) from public.employee_questions q
    where q.cluster_id=c.id and q.organization_id=c.organization_id) as unique_source_count,
  (select count(distinct q.asked_by) from public.employee_questions q
    where q.cluster_id=c.id and q.organization_id=c.organization_id) as people_affected,
  (select count(*) from public.employee_questions q where q.cluster_id=c.id
    and q.organization_id=c.organization_id and q.escalated=true) as human_interruption_count,
  coalesce((select jsonb_agg(samples.question) from (
    select q.question from public.employee_questions q where q.cluster_id=c.id
      and q.organization_id=c.organization_id order by q.created_at desc limit 3
    ) samples),'[]'::jsonb) as representative_questions
from public.question_clusters c;
grant select on public.company_knowledge_gaps to authenticated;
comment on view public.company_knowledge_gaps is
  'Observed gap lifecycle and transparent factors. A proposal is never a resolved gap; channel/people counts include recorded interactions only.';
