import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { SessionCard } from "@/components/session-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listAssignedStudentsForTeacher,
  listTeacherSessions,
} from "@/lib/supabase/queries";
import { requireTeacherContext } from "@/lib/supabase/teacher-server";

export default async function TeacherDashboardPage() {
  const { profile, supabase } = await requireTeacherContext();
  const [sessions, assignedStudents] = await Promise.all([
    listTeacherSessions(supabase, profile.id),
    listAssignedStudentsForTeacher(supabase),
  ]);
  const studentNameById = new Map(
    assignedStudents.map((student) => [student.student_id, student.student_name]),
  );

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="space-y-6">
            <Badge>Teacher dashboard</Badge>
            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">
                Welcome back, {profile.full_name}.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-soft)]">
                Create private lessons for your assigned students and move
                straight into the browser-based lesson room with the first
                therapy worksheet demo ready to try.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/teacher/sessions/new"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
              >
                Create session
              </Link>
              <LogoutButton />
            </div>
          </Card>

          <Card className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
              Teacher profile
            </p>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                {profile.full_name}
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                {profile.email}
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                Role: {profile.role}
              </p>
              <p className="text-sm text-[var(--color-text-soft)]">
                Assigned students: {assignedStudents.length}
              </p>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                Assigned students
              </h2>
              <p className="text-sm text-[var(--color-text-soft)]">
                These student accounts are linked to you by an admin.
              </p>
            </div>
            <Badge>{assignedStudents.length}</Badge>
          </div>

          {assignedStudents.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-3">
              {assignedStudents.map((student) => (
                <Card key={student.assignment_id} className="space-y-3">
                  <p className="text-lg font-semibold text-[var(--color-text)]">
                    {student.student_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-soft)]">
                    {student.student_email}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="space-y-3">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                No assigned students yet
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                Ask an admin to assign a student to your account before you
                create private lessons.
              </p>
            </Card>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                Active sessions
              </h2>
              <p className="text-sm text-[var(--color-text-soft)]">
                These are the live tutoring rooms currently available to your
                assigned students.
              </p>
            </div>
            <Badge>{sessions.length} active</Badge>
          </div>

          {sessions.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  studentName={
                    session.student_id ? studentNameById.get(session.student_id) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Card className="space-y-3">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                No active sessions yet
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                Create your first session to generate a join code and launch the
                lesson room.
              </p>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
