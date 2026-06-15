import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { StudentAssignedSessionCard } from "@/components/student-assigned-session-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listAssignedStudentSessions } from "@/lib/supabase/queries";
import { requireStudentContext } from "@/lib/supabase/teacher-server";

export default async function StudentDashboardPage() {
  const { profile, supabase } = await requireStudentContext();
  const sessions = await listAssignedStudentSessions(supabase);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="space-y-6">
            <Badge>Student dashboard</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
                Welcome, {profile.full_name}.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-soft)]">
                Your assigned lessons are gathered here. Choose a lesson when
                your teacher is ready and continue learning.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/password/change"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-6 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
              >
                Change password
              </Link>
              <LogoutButton />
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
              Student profile
            </p>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                {profile.full_name}
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                {profile.email}
              </p>
              <p className="text-sm capitalize text-[var(--color-text-soft)]">
                Account: {profile.role}
              </p>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                Assigned lessons
              </h2>
              <p className="text-sm text-[var(--color-text-soft)]">
                Lessons prepared for you by your teacher.
              </p>
            </div>
            <Badge>{sessions.length}</Badge>
          </div>

          {sessions.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {sessions.map((session) => (
                <StudentAssignedSessionCard key={session.session_id} session={session} />
              ))}
            </div>
          ) : (
            <Card className="space-y-3">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                No assigned lessons yet
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                Your teacher will create lessons directly for your account. They
                will appear here when ready.
              </p>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
