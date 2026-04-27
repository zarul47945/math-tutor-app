alter table public.sessions
add column if not exists timer_running boolean not null default false,
add column if not exists timer_started_at timestamptz,
add column if not exists elapsed_seconds integer not null default 0;

create or replace function public.get_active_session_room_state(
  input_session_id uuid,
  input_join_code text
)
returns table (
  id uuid,
  title text,
  join_code text,
  status text,
  created_at timestamptz,
  timer_running boolean,
  timer_started_at timestamptz,
  elapsed_seconds integer
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
    sessions.created_at,
    sessions.timer_running,
    sessions.timer_started_at,
    sessions.elapsed_seconds
  from public.sessions
  where sessions.id = input_session_id
    and upper(sessions.join_code) = upper(trim(input_join_code))
    and sessions.status = 'active'
  limit 1;
$$;

revoke all on function public.get_active_session_room_state(uuid, text) from public;
grant execute on function public.get_active_session_room_state(uuid, text) to anon, authenticated;
