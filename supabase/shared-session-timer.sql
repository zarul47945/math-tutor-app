create or replace function public.update_active_session_timer(
  input_session_id uuid,
  input_join_code text,
  input_participant_id uuid default null,
  input_elapsed_seconds integer default 0,
  input_timer_running boolean default false,
  input_timer_started_at timestamptz default null
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
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.sessions%rowtype;
  is_allowed boolean := false;
begin
  select *
  into matched_session
  from public.sessions
  where sessions.id = input_session_id
    and upper(sessions.join_code) = upper(trim(input_join_code))
    and sessions.status = 'active'
  limit 1;

  if matched_session.id is null then
    return;
  end if;

  if auth.uid() is not null and auth.uid() = matched_session.teacher_id then
    is_allowed := true;
  end if;

  if not is_allowed and input_participant_id is not null then
    select exists (
      select 1
      from public.session_participants
      where session_participants.id = input_participant_id
        and session_participants.session_id = matched_session.id
    )
    into is_allowed;
  end if;

  if not is_allowed then
    return;
  end if;

  update public.sessions
  set
    elapsed_seconds = greatest(coalesce(input_elapsed_seconds, 0), 0),
    timer_running = coalesce(input_timer_running, false),
    timer_started_at = case
      when coalesce(input_timer_running, false) then input_timer_started_at
      else null
    end
  where sessions.id = matched_session.id;

  return query
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
  where sessions.id = matched_session.id
  limit 1;
end;
$$;

revoke all on function public.update_active_session_timer(uuid, text, uuid, integer, boolean, timestamptz) from public;
grant execute on function public.update_active_session_timer(uuid, text, uuid, integer, boolean, timestamptz) to anon, authenticated;
