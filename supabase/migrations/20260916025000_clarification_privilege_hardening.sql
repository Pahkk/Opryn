-- Supabase projects may grant table privileges automatically via default privileges.
-- RLS already rejects direct writes, but explicitly restrict this child table too.
revoke all on table public.question_clarifications from anon, authenticated;
grant select on table public.question_clarifications to authenticated;
grant all on table public.question_clarifications to service_role;
