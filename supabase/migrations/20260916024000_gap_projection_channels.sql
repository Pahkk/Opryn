-- Preserve the public projection contract while including real external interactions.
create or replace view public.company_knowledge_gaps with (security_invoker=true) as
select c.id,c.organization_id,c.topic,c.representative_question,c.classification,
  lower(regexp_replace(trim(c.representative_question),'[[:space:]]+',' ','g')) as normalized_question,
  c.question_count,c.created_at as first_seen_at,c.updated_at as last_seen_at,c.resolved_by_knowledge_id,
  case when c.status='dismissed' then 'dismissed' when c.status='resolved' then 'resolved'
    when exists(select 1 from public.employee_questions q join public.knowledge_proposals p
      on p.related_question_id=q.id and p.organization_id=q.organization_id where q.cluster_id=c.id
        and q.organization_id=c.organization_id and p.status in ('pending_approval','needs_review'))
      or exists(select 1 from public.external_ai_escalations e join public.knowledge_proposals p
        on p.id=e.knowledge_proposal_id and p.organization_id=e.organization_id where e.cluster_id=c.id
          and e.organization_id=c.organization_id and p.status in ('pending_approval','needs_review')) then 'proposed'
    when exists(select 1 from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id
      and q.status='needs_owner' and q.escalated) or exists(select 1 from public.external_ai_escalations e where e.cluster_id=c.id
        and e.organization_id=c.organization_id and e.status='open' and e.escalated) then 'routed'
    when exists(select 1 from public.employee_questions q join public.question_answers a on a.question_id=q.id
      and a.organization_id=q.organization_id where q.cluster_id=c.id and q.organization_id=c.organization_id and a.answer_type in ('owner','expert'))
      or exists(select 1 from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=c.organization_id and e.status='answered') then 'answered'
    when c.question_count=(select count(*) from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id and q.status='dismissed')
      +(select count(*) from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=c.organization_id and e.status='dismissed') then 'dismissed'
    else 'open' end as status,
  (select count(distinct channel) from (
    select q.origin as channel from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id
    union all select 'external_ai' from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=c.organization_id
  ) channels) as unique_source_count,
  (select count(distinct q.asked_by) from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id) as people_affected,
  (select count(*) from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id and q.escalated)
    +(select count(*) from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=c.organization_id and e.escalated) as human_interruption_count,
  coalesce((select jsonb_agg(samples.question) from (
    select question from (
      select q.question,q.created_at from public.employee_questions q where q.cluster_id=c.id and q.organization_id=c.organization_id
      union all select e.question,e.created_at from public.external_ai_escalations e where e.cluster_id=c.id and e.organization_id=c.organization_id
    ) interactions order by created_at desc limit 3
  ) samples),'[]'::jsonb) as representative_questions
from public.question_clusters c;
