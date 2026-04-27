alter table public.session_participants
add column if not exists student_id uuid references public.profiles (id) on delete set null;

create unique index if not exists session_participants_session_student_uidx
on public.session_participants (session_id, student_id)
where student_id is not null;

grant select, insert, update on public.session_participants to authenticated, service_role;

drop policy if exists "Students can read their own participant rows" on public.session_participants;

create policy "Students can read their own participant rows"
on public.session_participants
for select
to authenticated
using (student_id = auth.uid());

create or replace function public.join_assigned_session_as_authenticated_student(
  input_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_profile public.profiles%rowtype;
  matched_session public.sessions%rowtype;
  existing_participant public.session_participants%rowtype;
  saved_participant public.session_participants%rowtype;
begin
  select *
  into matched_profile
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.role = 'student'
  limit 1;

  if matched_profile.id is null then
    raise exception 'Only authenticated student accounts can join a lesson.';
  end if;

  select *
  into matched_session
  from public.sessions
  where sessions.id = input_session_id
    and sessions.student_id = matched_profile.id
    and sessions.status = 'active'
  limit 1;

  if matched_session.id is null then
    return null;
  end if;

  select *
  into existing_participant
  from public.session_participants
  where session_participants.session_id = matched_session.id
    and session_participants.student_id = matched_profile.id
  limit 1;

  if existing_participant.id is null then
    insert into public.session_participants (
      session_id,
      student_id,
      display_name,
      role
    )
    values (
      matched_session.id,
      matched_profile.id,
      matched_profile.full_name,
      'student'
    )
    returning *
    into saved_participant;
  else
    update public.session_participants
    set display_name = matched_profile.full_name
    where id = existing_participant.id
    returning *
    into saved_participant;
  end if;

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
      'id', saved_participant.id,
      'session_id', saved_participant.session_id,
      'student_id', saved_participant.student_id,
      'display_name', saved_participant.display_name,
      'role', saved_participant.role,
      'joined_at', saved_participant.joined_at
    )
  );
end;
$$;

revoke all on function public.join_assigned_session_as_authenticated_student(uuid) from public;
grant execute on function public.join_assigned_session_as_authenticated_student(uuid) to authenticated;
