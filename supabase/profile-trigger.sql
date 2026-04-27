create or replace function public.handle_new_platform_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
begin
  next_role := coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'teacher');

  if next_role not in ('admin', 'teacher', 'student') then
    next_role := 'teacher';
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'user@example.com'), '@', 1)
    ),
    coalesce(new.email, ''),
    next_role
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_platform_user();
