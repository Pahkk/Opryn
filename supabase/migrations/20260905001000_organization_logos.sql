alter table public.organizations
  add column if not exists logo_path text
  check (logo_path is null or char_length(logo_path) <= 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-logos',
  'organization-logos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy organization_logos_member_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-logos'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy organization_logos_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-logos'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

create policy organization_logos_admin_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'organization-logos'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'organization-logos'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

create policy organization_logos_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'organization-logos'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

comment on column public.organizations.logo_path is
  'Private organization-scoped logo stored in the organization-logos bucket.';
