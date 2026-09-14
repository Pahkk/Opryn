drop policy if exists communication_integrations_member_read on public.communication_integrations;
drop policy if exists communication_integrations_admin_all on public.communication_integrations;
create policy communication_integrations_admin_read
on public.communication_integrations for select to authenticated
using (public.is_org_admin(organization_id));
create policy communication_integrations_admin_write
on public.communication_integrations for all to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists communication_links_user_read on public.communication_link_tokens;
drop policy if exists communication_oauth_admin_read on public.communication_oauth_states;

drop policy if exists communication_messages_read on public.communication_messages;
create policy communication_messages_read
on public.communication_messages for select to authenticated
using (
  exists (
    select 1
    from public.communication_conversations as conversation
    where conversation.id = communication_messages.conversation_id
      and conversation.organization_id = communication_messages.organization_id
      and (
        public.is_org_admin(communication_messages.organization_id)
        or conversation.opryn_user_id = (select auth.uid())
      )
  )
);

revoke all on table public.communication_jobs from anon, authenticated;
revoke all on table public.communication_link_tokens from anon, authenticated;
revoke all on table public.communication_oauth_states from anon, authenticated;
revoke all on table public.communication_rate_limits from anon, authenticated;
revoke all on table public.communication_chat_state from anon, authenticated;
revoke all on table public.communication_chat_subscriptions from anon, authenticated;
revoke all on table public.communication_chat_locks from anon, authenticated;
revoke all on table public.communication_chat_queues from anon, authenticated;
