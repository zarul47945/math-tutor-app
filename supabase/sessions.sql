create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  join_code text not null unique check (join_code ~ '^MATH-[0-9]{4}$'),
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.sessions enable row level security;

grant usage on schema public to authenticated, anon, service_role;
grant select, insert, update on public.sessions to authenticated, service_role;

create policy "Teachers can read their own sessions"
on public.sessions
for select
to authenticated
using (auth.uid() = teacher_id);

create policy "Teachers can insert their own sessions"
on public.sessions
for insert
to authenticated
with check (auth.uid() = teacher_id and status = 'active');

create policy "Teachers can update their own sessions"
on public.sessions
for update
to authenticated
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create or replace function public.find_active_session_by_join_code(input_join_code text)
returns table (
  id uuid,
  title text,
  join_code text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    sessions.id,
    sessions.title,
    sessions.join_code,
    sessions.status,
    sessions.created_at
  from public.sessions
  where upper(sessions.join_code) = upper(trim(input_join_code))
    and sessions.status = 'active'
  limit 1;
$$;

revoke all on function public.find_active_session_by_join_code(text) from public;
grant execute on function public.find_active_session_by_join_code(text) to anon, authenticated;
