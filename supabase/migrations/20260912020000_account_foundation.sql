-- Personal settings are deliberately separate from teammate-readable profiles.
create table public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 120),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 80),
  timezone_overridden boolean not null default false,
  locale text not null default 'en-US' check (locale in ('en-US','en-GB','en-CA','en-AU')),
  density text not null default 'comfortable' check (density in ('comfortable','compact')),
  motion text not null default 'system' check (motion in ('system','reduced')),
  notify_questions boolean not null default true,
  notify_reviews boolean not null default true,
  notify_answers boolean not null default true,
  avatar_path text,
  avatar_hidden boolean not null default false,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  check (avatar_path is null or avatar_path like user_id::text || '/%')
);
alter table public.account_settings enable row level security;
grant select on public.account_settings to authenticated;
revoke insert, update, delete on public.account_settings from authenticated, anon;
create policy account_settings_self on public.account_settings for select to authenticated using (user_id = (select auth.uid()));

create function public.save_account_settings(expected_revision integer, changes jsonb)
returns public.account_settings language plpgsql security definer set search_path = '' as $$
declare saved public.account_settings;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb or exists (
    select 1 from jsonb_object_keys(changes) k where k not in ('display_name','timezone','locale','density','motion','notify_questions','notify_reviews','notify_answers','avatar_path','avatar_hidden')
  ) then raise exception 'Invalid account settings' using errcode = '22023'; end if;
  insert into public.account_settings(user_id) values(auth.uid()) on conflict do nothing;
  select * into saved from public.account_settings where user_id = auth.uid() for update;
  if saved.revision <> expected_revision then raise exception 'Settings changed. Reload before saving.' using errcode = '40001'; end if;
  if changes ? 'timezone' and not exists(select 1 from pg_timezone_names where name = changes->>'timezone') then raise exception 'Choose a timezone' using errcode = '22023'; end if;
  update public.account_settings set
    display_name = case when changes ? 'display_name' then changes->>'display_name' else display_name end,
    timezone = coalesce(changes->>'timezone', timezone), locale = coalesce(changes->>'locale',locale),
    timezone_overridden = timezone_overridden or changes ? 'timezone',
    density = coalesce(changes->>'density',density), motion = coalesce(changes->>'motion',motion),
    notify_questions = coalesce((changes->>'notify_questions')::boolean,notify_questions),
    notify_reviews = coalesce((changes->>'notify_reviews')::boolean,notify_reviews),
    notify_answers = coalesce((changes->>'notify_answers')::boolean,notify_answers),
    avatar_path = case when changes ? 'avatar_path' then changes->>'avatar_path' else avatar_path end,
    avatar_hidden = coalesce((changes->>'avatar_hidden')::boolean,avatar_hidden),
    revision = revision + 1, updated_at = now()
    where user_id = auth.uid() returning * into saved;
  if changes ? 'display_name' then update public.profiles set full_name = saved.display_name, updated_at = now() where id = auth.uid(); end if;
  return saved;
end;
$$;
revoke all on function public.save_account_settings(integer,jsonb) from public, anon;
grant execute on function public.save_account_settings(integer,jsonb) to authenticated;

-- OAuth/profile provisioning must not overwrite an explicitly saved Opryn name.
create function public.preserve_account_display_name() returns trigger language plpgsql security definer set search_path = '' as $$
declare preferred text;
begin
  select display_name into preferred from public.account_settings where user_id = new.id;
  if preferred is not null then new.full_name := preferred; end if;
  return new;
end;
$$;
create trigger preserve_account_display_name before insert or update of full_name on public.profiles for each row execute function public.preserve_account_display_name();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('account-avatars','account-avatars',false,2097152,array['image/webp']) on conflict(id) do nothing;
create policy account_avatar_read on storage.objects for select to authenticated using (bucket_id = 'account-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy account_avatar_insert on storage.objects for insert to authenticated with check (bucket_id = 'account-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy account_avatar_delete on storage.objects for delete to authenticated using (bucket_id = 'account-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.organization_settings add column settings_revision integer not null default 1;
alter table public.organizations add column description text not null default '' check (char_length(description) <= 2000);
alter table public.organizations add column default_timezone text not null default 'UTC';

-- Older server-side writers also invalidate revision-aware Settings forms.
create function public.bump_settings_revision() returns trigger language plpgsql set search_path='' as $$
begin
  new.settings_revision := old.settings_revision + 1;
  return new;
end;
$$;
create trigger bump_settings_revision before update on public.organization_settings for each row execute function public.bump_settings_revision();

create table public.workspace_settings_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  changed_fields text[] not null,
  created_at timestamptz not null default now()
);
alter table public.workspace_settings_events enable row level security;
grant select on public.workspace_settings_events to authenticated;
revoke insert,update,delete on public.workspace_settings_events from authenticated,anon;
create policy settings_events_admin on public.workspace_settings_events for select to authenticated using(public.is_org_admin(organization_id));

create function public.save_workspace_settings(workspace_id uuid, expected_revision integer, changes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
  if not public.is_org_admin(workspace_id) then raise exception 'Owner or admin access required' using errcode='42501'; end if;
  if jsonb_typeof(changes) <> 'object' or changes = '{}'::jsonb or exists(select 1 from jsonb_object_keys(changes) k where k not in (
    'name','industry','employee_count','description','default_timezone','employees_can_ask','allow_escalations','confidence_threshold','estimated_interruption_minutes','expert_answers_require_admin_approval','ai_process_creation','ai_process_approval_prompt'
  )) then raise exception 'Invalid workspace settings' using errcode='22023'; end if;
  select settings_revision into current_revision from public.organization_settings where organization_id = workspace_id for update;
  if current_revision is null or current_revision <> expected_revision then raise exception 'Settings changed. Reload before saving.' using errcode='40001'; end if;
  if changes ? 'default_timezone' and not exists(select 1 from pg_timezone_names where name = changes->>'default_timezone') then raise exception 'Choose a timezone' using errcode='22023'; end if;
  update public.organizations set name=coalesce(changes->>'name',name),industry=coalesce(changes->>'industry',industry),
    employee_count=coalesce((changes->>'employee_count')::integer,employee_count),description=coalesce(changes->>'description',description),
    default_timezone=coalesce(changes->>'default_timezone',default_timezone) where id=workspace_id;
  update public.organization_settings set
    employees_can_ask=coalesce((changes->>'employees_can_ask')::boolean,employees_can_ask),
    allow_escalations=coalesce((changes->>'allow_escalations')::boolean,allow_escalations),
    confidence_threshold=coalesce((changes->>'confidence_threshold')::real,confidence_threshold),
    estimated_interruption_minutes=coalesce((changes->>'estimated_interruption_minutes')::numeric,estimated_interruption_minutes),
    expert_answers_require_admin_approval=coalesce((changes->>'expert_answers_require_admin_approval')::boolean,expert_answers_require_admin_approval),
    ai_process_creation=coalesce(changes->>'ai_process_creation',ai_process_creation),
    ai_process_approval_prompt=coalesce(changes->>'ai_process_approval_prompt',ai_process_approval_prompt),
    settings_revision=settings_revision+1 where organization_id=workspace_id;
  insert into public.workspace_settings_events(organization_id,actor_id,changed_fields) values(workspace_id,auth.uid(),array(select jsonb_object_keys(changes)));
  return current_revision+1;
end;
$$;
revoke all on function public.save_workspace_settings(uuid,integer,jsonb) from public, anon;
grant execute on function public.save_workspace_settings(uuid,integer,jsonb) to authenticated;

-- Fail closed rather than silently orphaning expertise or person-owned sources.
create function public.member_removal_impact(workspace_id uuid, member_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.organization_members; result jsonb;
begin
  if not public.is_org_admin(workspace_id) then raise exception 'Owner or admin access required' using errcode='42501'; end if;
  select * into target from public.organization_members where id=member_id and organization_id=workspace_id;
  if target.id is null then raise exception 'Member not found' using errcode='P0002'; end if;
  select jsonb_build_object(
    'questions',(select count(*) from public.employee_questions where organization_id=workspace_id and assigned_expert_id=target.user_id and status='needs_owner'),
    'expertise',(select count(*) from public.knowledge_experts where organization_id=workspace_id and user_id=target.user_id),
    'connections',(select count(*) from public.integrations where organization_id=workspace_id and connected_by=target.user_id and status <> 'disconnected'),
    'isOwner',target.permission_level='owner'
  ) into result;
  return result;
end;
$$;
create function public.remove_workspace_member(workspace_id uuid, member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare impact jsonb;
begin
  if not public.is_org_admin(workspace_id) then raise exception 'Owner or admin access required' using errcode='42501'; end if;
  perform 1 from public.organization_members where id=member_id and organization_id=workspace_id for update;
  impact:=public.member_removal_impact(workspace_id,member_id);
  if (impact->>'isOwner')::boolean then raise exception 'The workspace owner cannot be removed.' using errcode='42501'; end if;
  if (impact->>'questions')::integer+(impact->>'expertise')::integer+(impact->>'connections')::integer > 0 then
    raise exception 'Resolve assigned questions, reassign expertise, and reconnect or disconnect their sources before removing this person.' using errcode='23503';
  end if;
  delete from public.organization_members where id=member_id and organization_id=workspace_id;
end;
$$;
revoke all on function public.member_removal_impact(uuid,uuid),public.remove_workspace_member(uuid,uuid) from public,anon;
grant execute on function public.member_removal_impact(uuid,uuid),public.remove_workspace_member(uuid,uuid) to authenticated;
revoke delete on public.organization_members from authenticated;
-- The old one-table delete did not coordinate billing, credentials or storage.
-- Deletion remains support-assisted until the complete cleanup workflow exists.
revoke delete on public.organizations from authenticated;
