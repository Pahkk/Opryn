-- Additive, not applied automatically. Existing workspaces retain their access.
alter table public.organization_onboarding add column activation_answer_id uuid references public.employee_questions(id) on delete set null;
alter table public.organization_onboarding add column billing_required boolean not null default false;
alter table public.organization_onboarding alter column billing_required set default true;
alter table public.organization_subscriptions add column trial_end timestamptz;
-- Access policy belongs to the server-owned billing entity, not the editable wizard.
alter table public.organization_subscriptions add column onboarding_billing_required boolean not null default false;
alter table public.organization_subscriptions alter column onboarding_billing_required set default true;
alter table public.organization_subscriptions add column activation_completed_at timestamptz;
create function public.preserve_trial_consumption() returns trigger language plpgsql set search_path='' as $$
begin new.trial_used := old.trial_used or new.trial_used; return new; end; $$;
create trigger preserve_trial_consumption before update on public.organization_subscriptions for each row execute function public.preserve_trial_consumption();

create table public.setup_suggestion_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null, request_count integer not null
);
alter table public.setup_suggestion_limits enable row level security;
revoke all on public.setup_suggestion_limits from public, anon, authenticated;
create function public.consume_setup_suggestion_limit() returns boolean
language plpgsql security definer set search_path='' as $$
declare next_count integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.setup_suggestion_limits as limits values(auth.uid(), date_trunc('hour',now()),1)
  on conflict(user_id) do update set window_start=excluded.window_start,
    request_count=case when limits.window_start=excluded.window_start then least(limits.request_count+1,21) else 1 end
  returning request_count into next_count;
  return next_count<=20;
end; $$;
revoke all on function public.consume_setup_suggestion_limit() from public,anon;
grant execute on function public.consume_setup_suggestion_limit() to authenticated;

create or replace function public.save_company_profile(workspace_id uuid, expected_revision integer, profile jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare revision integer;
begin
  if not public.is_org_admin(workspace_id) then raise exception 'Owner or admin required' using errcode='42501'; end if;
  if jsonb_typeof(profile)<>'object' or octet_length(profile::text)>12000 or length(trim(coalesce(profile->>'name','')))=0
    or exists(select 1 from jsonb_object_keys(profile) k where k not in ('name','industry','description','employee_count','website','departments','knowledge_areas','notes','normalizedIndustryId','customIndustryLabel','firstTeachQuestion','recommendedSource','sourceReason'))
    then raise exception 'Invalid company profile' using errcode='22023'; end if;
  if profile->>'normalizedIndustryId' is not null and profile->>'normalizedIndustryId' not in ('technology','professional_services','marketing','construction','automotive','local_services','hospitality','logistics','retail','healthcare','education','real_estate','manufacturing','finance','nonprofit','other')
    then raise exception 'Invalid industry' using errcode='22023'; end if;
  revision := public.save_workspace_settings(workspace_id, expected_revision,
    jsonb_build_object('name',profile->>'name','industry',profile->>'industry','description',profile->>'description','employee_count',(profile->>'employee_count')::integer));
  update public.organizations set company_profile=profile - array['name','industry','description','employee_count'] where id=workspace_id;
  update public.organization_discovery set business_description=profile->>'description' where organization_id=workspace_id;
  return revision;
end; $$;

-- A lease serializes checkout attempts across tabs/instances. Keep the attempt ID
-- on errors so Stripe's idempotency key recovers a successful-but-timed-out call.
create table public.organization_checkout (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  attempt_id uuid not null default gen_random_uuid(),
  lease_id uuid, lease_until timestamptz,
  fingerprint text not null,
  session_id text,
  initiated_by uuid,
  created_at timestamptz not null default now()
);
alter table public.organization_checkout enable row level security;
revoke all on public.organization_checkout from public,anon,authenticated;
grant all on public.organization_checkout to service_role;
create function public.claim_organization_checkout(workspace_id uuid, choice text, lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.organization_checkout;
begin
  insert into public.organization_checkout(organization_id,fingerprint) values(workspace_id,choice) on conflict do nothing;
  select * into row from public.organization_checkout where organization_id=workspace_id for update;
  if row.lease_until>now() then return null; end if;
  update public.organization_checkout set lease_id=lease,lease_until=now()+interval '2 minutes' where organization_id=workspace_id;
  return to_jsonb(row);
end; $$;
revoke all on function public.claim_organization_checkout(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_organization_checkout(uuid,text,uuid) to service_role;

-- Even direct PostgREST writes cannot finish new onboarding on a browser claim.
create function public.guard_activation_completion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.billing_required and not new.billing_required then raise exception 'Billing requirement is server managed' using errcode='42501'; end if;
  if old.billing_required and old.first_test_answered and not new.first_test_answered then raise exception 'Activation cannot reset trial access' using errcode='42501'; end if;
  if new.billing_required and ((new.first_test_answered and not old.first_test_answered) or (new.onboarding_complete and not old.onboarding_complete)) then
    if not exists(select 1 from public.employee_questions q where q.id=new.activation_answer_id and q.organization_id=new.organization_id and q.answered_by_opryn and q.status='answered')
      or not exists(select 1 from public.processes p where p.id=new.activation_process_id and p.organization_id=new.organization_id and p.status='approved' and p.library_archived_at is null)
      then raise exception 'Real activation required' using errcode='42501'; end if;
    if new.onboarding_complete and not exists(select 1 from public.organization_subscriptions s where s.organization_id=new.organization_id and s.stripe_subscription_id is not null and s.status in ('active','trialing'))
      then raise exception 'Verified subscription required' using errcode='42501'; end if;
  end if;
  return new;
end; $$;
create trigger guard_activation_completion before update on public.organization_onboarding for each row execute function public.guard_activation_completion();

create function public.record_activation_answer(workspace_id uuid, question_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.is_org_admin(workspace_id) then return false; end if;
  if not exists(select 1 from public.employee_questions q
    join public.organization_onboarding o on o.organization_id=q.organization_id
    join public.processes p on p.id=o.activation_process_id and p.organization_id=q.organization_id
    where q.id=question_id and q.organization_id=workspace_id and q.asked_by=auth.uid()
    and q.status='answered' and q.answered_by_opryn and p.status='approved' and p.library_archived_at is null
    and exists(select 1 from public.question_sources s where s.question_id=q.id and s.organization_id=workspace_id)
    and exists(select 1 from public.question_answers a where a.question_id=q.id and a.organization_id=workspace_id and a.answer_type='opryn'))
    then return false; end if;
  update public.organization_subscriptions set activation_completed_at=coalesce(activation_completed_at,now()) where organization_id=workspace_id;
  update public.organization_onboarding set first_test_answered=true,activation_answer_id=question_id where organization_id=workspace_id;
  return true;
end; $$;
revoke all on function public.record_activation_answer(uuid,uuid) from public,anon;
grant execute on function public.record_activation_answer(uuid,uuid) to authenticated;
