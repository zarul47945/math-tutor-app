-- Replace the email below with the account that should become your first admin.
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
