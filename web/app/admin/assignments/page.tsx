import Link from "next/link";

import { AdminTeacherStudentAssignmentForm } from "@/components/admin-teacher-student-assignment-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  listProfilesByRole,
  listTeacherStudentAssignments,
} from "@/lib/supabase/admin-queries";
import { requireAdminContext } from "@/lib/supabase/teacher-server";

export default async function AdminAssignmentsPage() {
  await requireAdminContext();

  const [teachers, students, assignments] = await Promise.all([
    listProfilesByRole("teacher"),
    listProfilesByRole("student"),
    listTeacherStudentAssignments(),
  ]);

  return (
    <main className="min-h-screen px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
          >
            Back to admin dashboard
          </Link>
        </div>

        <AdminTeacherStudentAssignmentForm students={students} teachers={teachers} />

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
                Active assignments
              </h2>
              <p className="text-sm text-[var(--color-text-soft)]">
                Students are linked here so teachers can only create lessons for
                their assigned learners.
              </p>
            </div>
            <Badge>{assignments.length}</Badge>
          </div>

          {assignments.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {assignments.map((assignment) => (
                <Card key={assignment.assignment_id} className="space-y-3">
                  <p className="text-lg font-semibold text-[var(--color-text)]">
                    {assignment.student_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-soft)]">
                    Student email: {assignment.student_email}
                  </p>
                  <p className="text-sm text-[var(--color-text-soft)]">
                    Teacher: {assignment.teacher_name}
                  </p>
                  <p className="text-sm text-[var(--color-text-soft)]">
                    Teacher email: {assignment.teacher_email}
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="space-y-3">
              <p className="text-lg font-semibold text-[var(--color-text)]">
                No active assignments yet
              </p>
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                Create teacher and student accounts first, then link them here.
              </p>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
