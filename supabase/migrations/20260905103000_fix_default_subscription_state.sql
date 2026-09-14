-- A workspace does not have a paid plan until Stripe creates a subscription.
-- Preserve the row for entitlement lookups, but do not represent it as active.
create or replace function public.create_default_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_subscriptions (organization_id, plan, status)
  values (new.id, 'core', 'incomplete')
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

update public.organization_subscriptions
set status = 'incomplete'
where stripe_subscription_id is null
  and status = 'active';
