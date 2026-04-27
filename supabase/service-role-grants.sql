grant usage on schema public to service_role;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    grant select, insert, update on public.profiles to service_role;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'teacher_students'
  ) then
    grant select, insert, update on public.teacher_students to service_role;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'sessions'
  ) then
    grant select, insert, update on public.sessions to service_role;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'session_participants'
  ) then
    grant select, insert, update on public.session_participants to service_role;
  end if;
end
$$;
