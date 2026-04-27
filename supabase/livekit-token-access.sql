create or replace function public.get_active_session_participant(
  input_session_id uuid,
  input_participant_id uuid
)
returns table (
  id uuid,
  session_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    session_participants.id,
    session_participants.session_id,
    session_participants.display_name,
    session_participants.role,
    session_participants.joined_at
  from public.session_participants
  inner join public.sessions
    on sessions.id = session_participants.session_id
  where session_participants.id = input_participant_id
    and session_participants.session_id = input_session_id
    and sessions.status = 'active'
  limit 1;
$$;

revoke all on function public.get_active_session_participant(uuid, uuid) from public;
grant execute on function public.get_active_session_participant(uuid, uuid) to anon, authenticated;
