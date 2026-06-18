alter table public.session_worksheets
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_mime_type text,
  add column if not exists file_size_bytes integer;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'worksheet-files',
  'worksheet-files',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Teachers can upload worksheet files" on storage.objects;
drop policy if exists "Teachers can update worksheet files" on storage.objects;
drop policy if exists "Teachers can delete worksheet files" on storage.objects;
drop policy if exists "Lesson users can read worksheet files" on storage.objects;

create policy "Teachers can upload worksheet files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'worksheet-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.sessions
    where sessions.id::text = (storage.foldername(name))[2]
      and sessions.teacher_id = auth.uid()
  )
);

create policy "Teachers can update worksheet files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'worksheet-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'worksheet-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Teachers can delete worksheet files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'worksheet-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Lesson users can read worksheet files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'worksheet-files'
  and exists (
    select 1
    from public.session_worksheets
    join public.sessions
      on sessions.id = session_worksheets.session_id
    where session_worksheets.file_path = storage.objects.name
      and (
        sessions.teacher_id = auth.uid()
        or (
          sessions.student_id = auth.uid()
          and sessions.status = 'active'
        )
      )
  )
);
