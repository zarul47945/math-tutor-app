"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createTeacherSession } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { TeacherSession, TeacherStudentAssignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateSessionForm({
  assignedStudents,
  teacherId,
}: {
  assignedStudents: TeacherStudentAssignment[];
  teacherId: string;
}) {
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState(assignedStudents[0]?.student_id ?? "");
  const [createdSession, setCreatedSession] = useState<TeacherSession | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    startTransition(async () => {
      const supabase = createClient();
      setFeedback(null);

      if (!title.trim()) {
        setFeedback("Please enter a session title.");
        return;
      }

      if (!studentId) {
        setFeedback("Please select a student for this lesson.");
        return;
      }

      try {
        const nextSession = await createTeacherSession(
          supabase,
          teacherId,
          title.trim(),
          studentId,
        );

        setCreatedSession(nextSession);
        setTitle(nextSession.title);
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to create the session right now.",
        );
      }
    });
  };

  return (
    <Card className="max-w-3xl p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Create a session
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Generate a private lesson for the selected student. This first build
          opens with the therapy worksheet demo inside the live lesson room.
        </p>
      </div>

      {assignedStudents.length > 0 ? (
        <div className="mt-8 space-y-5">
          <Field label="Student">
            <select
              className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
              onChange={(event) => setStudentId(event.target.value)}
              value={studentId}
            >
              {assignedStudents.map((student) => (
                <option key={student.assignment_id} value={student.student_id}>
                  {student.student_name} ({student.student_email})
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          No students are assigned to you yet. Ask an admin to link a student
          account before creating a lesson.
        </div>
      )}

      <div className="mt-8 space-y-5">
        <Field label="Session title" hint="Example: Algebra Revision - April 27">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Algebra Revision"
          />
        </Field>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={handleCreate}
          disabled={isPending || assignedStudents.length === 0}
          className="sm:w-auto"
        >
          {isPending ? "Creating session..." : "Create session"}
        </Button>
        <Link
          href="/teacher/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          Back to dashboard
        </Link>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <div className="mt-8 rounded-[24px] bg-[var(--color-surface-soft)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
          Lesson access
        </p>
        <p className="mt-3 text-lg font-semibold text-[var(--color-text)]">
          {createdSession
            ? "This lesson is now assigned to the selected student account."
            : "The selected student will see this lesson directly in their dashboard after creation."}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text-soft)]">
          {createdSession
            ? "Saved to Supabase and ready for the assigned student to join."
            : "Room codes stay internal now, while the student joins straight from their dashboard and sees the therapy demo worksheet in the room."}
        </p>
      </div>

      {createdSession ? (
        <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-[var(--color-border)] p-5">
          <p className="text-lg font-semibold text-[var(--color-text)]">
            {createdSession.title}
          </p>
          <p className="text-sm text-[var(--color-text-soft)]">
            Internal room code: {createdSession.join_code}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/room/${createdSession.id}?role=teacher&joinCode=${encodeURIComponent(
                createdSession.join_code,
              )}&sessionTitle=${encodeURIComponent(createdSession.title)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
            >
              Enter video room
            </Link>
            <Link
              href="/teacher/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-white hover:text-[var(--color-text)]"
            >
              See all active sessions
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
