grant delete on public.sessions to authenticated, service_role;

drop policy if exists "Teachers can delete their own sessions" on public.sessions;

create policy "Teachers can delete their own sessions"
on public.sessions
for delete
to authenticated
using (auth.uid() = teacher_id);
