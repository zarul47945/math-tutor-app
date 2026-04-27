create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'teacher' check (role in ('admin', 'teacher', 'student')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update on public.profiles to authenticated, service_role;

drop policy if exists "Teachers can read their own profile" on public.profiles;
drop policy if exists "Teachers can insert their own profile" on public.profiles;
drop policy if exists "Teachers can update their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and role in ('admin', 'teacher', 'student'));

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role in ('admin', 'teacher', 'student'));
