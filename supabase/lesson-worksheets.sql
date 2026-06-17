create extension if not exists pgcrypto;

create table if not exists public.session_worksheets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Skills practice',
  instructions text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.worksheet_questions (
  id uuid primary key default gen_random_uuid(),
  worksheet_id uuid not null references public.session_worksheets (id) on delete cascade,
  set_key text not null,
  set_title text not null,
  set_order integer not null,
  position integer not null,
  augend integer not null,
  result integer not null,
  expected_answer integer not null,
  best_time_label text not null default '00:30',
  created_at timestamptz not null default timezone('utc', now()),
  unique (worksheet_id, set_key, position)
);

alter table public.session_worksheets enable row level security;
alter table public.worksheet_questions enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.session_worksheets to authenticated, service_role;
grant select, insert, update, delete on public.worksheet_questions to authenticated, service_role;

drop policy if exists "Teachers can read worksheets for their own sessions" on public.session_worksheets;
drop policy if exists "Students can read worksheets for assigned sessions" on public.session_worksheets;
drop policy if exists "Teachers can insert worksheets for their own sessions" on public.session_worksheets;
drop policy if exists "Teachers can update worksheets for their own sessions" on public.session_worksheets;
drop policy if exists "Teachers can delete worksheets for their own sessions" on public.session_worksheets;

create policy "Teachers can read worksheets for their own sessions"
on public.session_worksheets
for select
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.teacher_id = auth.uid()
  )
);

create policy "Students can read worksheets for assigned sessions"
on public.session_worksheets
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.student_id = auth.uid()
      and sessions.status = 'active'
  )
);

create policy "Teachers can insert worksheets for their own sessions"
on public.session_worksheets
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.teacher_id = auth.uid()
  )
);

create policy "Teachers can update worksheets for their own sessions"
on public.session_worksheets
for update
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.teacher_id = auth.uid()
  )
);

create policy "Teachers can delete worksheets for their own sessions"
on public.session_worksheets
for delete
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.sessions
    where sessions.id = session_worksheets.session_id
      and sessions.teacher_id = auth.uid()
  )
);

drop policy if exists "Users can read questions for readable worksheets" on public.worksheet_questions;
drop policy if exists "Teachers can insert questions for their worksheets" on public.worksheet_questions;
drop policy if exists "Teachers can update questions for their worksheets" on public.worksheet_questions;
drop policy if exists "Teachers can delete questions for their worksheets" on public.worksheet_questions;

create policy "Users can read questions for readable worksheets"
on public.worksheet_questions
for select
to authenticated
using (
  exists (
    select 1
    from public.session_worksheets
    join public.sessions
      on sessions.id = session_worksheets.session_id
    where session_worksheets.id = worksheet_questions.worksheet_id
      and (
        sessions.teacher_id = auth.uid()
        or (
          sessions.student_id = auth.uid()
          and sessions.status = 'active'
        )
      )
  )
);

create policy "Teachers can insert questions for their worksheets"
on public.worksheet_questions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.session_worksheets
    where session_worksheets.id = worksheet_questions.worksheet_id
      and session_worksheets.teacher_id = auth.uid()
  )
);

create policy "Teachers can update questions for their worksheets"
on public.worksheet_questions
for update
to authenticated
using (
  exists (
    select 1
    from public.session_worksheets
    where session_worksheets.id = worksheet_questions.worksheet_id
      and session_worksheets.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.session_worksheets
    where session_worksheets.id = worksheet_questions.worksheet_id
      and session_worksheets.teacher_id = auth.uid()
  )
);

create policy "Teachers can delete questions for their worksheets"
on public.worksheet_questions
for delete
to authenticated
using (
  exists (
    select 1
    from public.session_worksheets
    where session_worksheets.id = worksheet_questions.worksheet_id
      and session_worksheets.teacher_id = auth.uid()
  )
);
