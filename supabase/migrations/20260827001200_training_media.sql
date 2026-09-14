create table public.process_training_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.processes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null check (char_length(storage_path) between 1 and 1000),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  original_name text not null check (char_length(original_name) between 1 and 500),
  caption text not null default '' check (char_length(caption) <= 500),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

alter table public.process_training_media
  add constraint process_training_media_process_same_org
  foreign key (process_id, organization_id)
  references public.processes(id, organization_id)
  on delete cascade;

create index process_training_media_process_idx
  on public.process_training_media(organization_id, process_id, created_at);

alter table public.process_training_media enable row level security;

create policy process_training_media_read
  on public.process_training_media for select to authenticated
  using (public.is_org_member(organization_id));

create policy process_training_media_admin_all
  on public.process_training_media for all to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'training-media',
  'training-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy training_media_storage_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'training-media'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy training_media_storage_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'training-media'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

create policy training_media_storage_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'training-media'
    and public.is_org_admin((storage.foldername(name))[1]::uuid)
  );

grant select, insert, update, delete on public.process_training_media to authenticated;

comment on table public.process_training_media is
  'Private instructional images attached to an approved process for employee training.';
