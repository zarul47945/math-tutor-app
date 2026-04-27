create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  display_name text not null,
  role text not null default 'student' check (role = 'student'),
  joined_at timestamptz not null default timezone('utc', now())
);

alter table public.session_participants enable row level security;

grant usage on schema public to authenticated, anon, service_role;
grant select, insert, update on public.session_participants to authenticated, service_role;

create policy "Teachers can read participants in their own sessions"
on public.session_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.sessions
    where sessions.id = session_participants.session_id
      and sessions.teacher_id = auth.uid()
  )
);

create or replace function public.join_active_session_as_student(
  input_join_code text,
  input_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.sessions%rowtype;
  new_participant public.session_participants%rowtype;
begin
  select *
  into matched_session
  from public.sessions
  where upper(sessions.join_code) = upper(trim(input_join_code))
    and sessions.status = 'active'
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  insert into public.session_participants (
    session_id,
    display_name,
    role
  )
  values (
    matched_session.id,
    trim(input_display_name),
    'student'
  )
  returning *
  into new_participant;

  return jsonb_build_object(
    'session',
    jsonb_build_object(
      'id', matched_session.id,
      'title', matched_session.title,
      'join_code', matched_session.join_code,
      'status', matched_session.status,
      'created_at', matched_session.created_at
    ),
    'participant',
    jsonb_build_object(
      'id', new_participant.id,
      'session_id', new_participant.session_id,
      'display_name', new_participant.display_name,
      'role', new_participant.role,
      'joined_at', new_participant.joined_at
    )
  );
end;
$$;

revoke all on function public.join_active_session_as_student(text, text) from public;
grant execute on function public.join_active_session_as_student(text, text) to anon, authenticated;
