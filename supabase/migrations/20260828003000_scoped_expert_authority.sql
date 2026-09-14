alter table public.employee_questions
  add column if not exists assigned_expert_rule_id uuid
    references public.knowledge_experts(id) on delete set null;

create index if not exists employee_questions_expert_rule_idx
  on public.employee_questions(organization_id, assigned_expert_rule_id)
  where assigned_expert_rule_id is not null;

comment on column public.employee_questions.assigned_expert_rule_id is
  'The exact knowledge-area assignment that routed this question, used to scope expert approval authority.';
