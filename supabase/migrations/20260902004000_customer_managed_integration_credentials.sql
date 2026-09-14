alter table public.integrations
  drop constraint if exists integrations_connection_type_check;

alter table public.integrations
  add constraint integrations_connection_type_check check (connection_type in (
    'native_oauth','embedded_oauth','credential_guide','mcp','api_key_advanced','manual'
  ));

create table public.integration_credentials (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encrypted_payload text not null,
  credential_hint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index integration_credentials_org_idx
  on public.integration_credentials(organization_id);

create trigger integration_credentials_updated before update on public.integration_credentials
for each row execute function public.set_updated_at();

alter table public.integration_credentials enable row level security;

revoke all on public.integration_credentials from public, anon, authenticated;

comment on table public.integration_credentials is
  'Server-only AES-GCM encrypted customer-supplied integration credentials. No browser role has table access.';

comment on column public.integration_credentials.credential_hint is
  'Non-secret display metadata only, such as a masked token suffix or account domain.';
