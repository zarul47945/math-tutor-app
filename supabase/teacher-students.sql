create table if not exists public.teacher_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (teacher_id, student_id)
);

create unique index if not exists teacher_students_active_student_uidx
on public.teacher_students (student_id)
where status = 'active';

alter table public.teacher_students enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.teacher_students to authenticated, service_role;

drop policy if exists "Teachers can read their own student assignments" on public.teacher_students;
drop policy if exists "Students can read their own teacher assignments" on public.teacher_students;

create policy "Teachers can read their own student assignments"
on public.teacher_students
for select
to authenticated
using (auth.uid() = teacher_id);

create policy "Students can read their own teacher assignments"
on public.teacher_students
for select
to authenticated
using (auth.uid() = student_id);

alter table public.sessions
add column if not exists student_id uuid references public.profiles (id) on delete set null;

drop policy if exists "Teachers can read their own sessions" on public.sessions;
drop policy if exists "Teachers can insert their own sessions" on public.sessions;
drop policy if exists "Teachers can update their own sessions" on public.sessions;
drop policy if exists "Students can read assigned sessions" on public.sessions;

create policy "Teachers can read their own sessions"
on public.sessions
for select
to authenticated
using (auth.uid() = teacher_id);

create policy "Students can read assigned sessions"
on public.sessions
for select
to authenticated
using (auth.uid() = student_id);

create policy "Teachers can insert sessions for assigned students"
on public.sessions
for insert
to authenticated
with check (
  auth.uid() = teacher_id
  and status = 'active'
  and student_id is not null
  and exists (
    select 1
    from public.teacher_students
    where teacher_students.teacher_id = auth.uid()
      and teacher_students.student_id = sessions.student_id
      and teacher_students.status = 'active'
  )
);

create policy "Teachers can update their own sessions"
on public.sessions
for update
to authenticated
using (auth.uid() = teacher_id)
with check (
  auth.uid() = teacher_id
  and (
    student_id is null
    or exists (
      select 1
      from public.teacher_students
      where teacher_students.teacher_id = auth.uid()
        and teacher_students.student_id = sessions.student_id
        and teacher_students.status = 'active'
    )
  )
);

create or replace function public.list_assigned_students_for_teacher()
returns table (
  assignment_id uuid,
  student_id uuid,
  student_name text,
  student_email text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    teacher_students.id as assignment_id,
    profiles.id as student_id,
    profiles.full_name as student_name,
    profiles.email as student_email,
    teacher_students.status,
    teacher_students.created_at
  from public.teacher_students
  inner join public.profiles
    on profiles.id = teacher_students.student_id
  where teacher_students.teacher_id = auth.uid()
  order by profiles.full_name asc;
$$;

revoke all on function public.list_assigned_students_for_teacher() from public;
grant execute on function public.list_assigned_students_for_teacher() to authenticated;
