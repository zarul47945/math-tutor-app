"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import type { AppProfile } from "@/lib/types";

export function AdminTeacherStudentAssignmentForm({
  students,
  teachers,
}: {
  students: AppProfile[];
  teachers: AppProfile[];
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAssign = () => {
    startTransition(async () => {
      setFeedback(null);

      const response = await fetch("/api/admin/teacher-students", {
        body: JSON.stringify({
          studentId,
          teacherId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const result = (await response.json()) as
        | { error: string }
        | { success: true };

      if (!response.ok || "error" in result) {
        setFeedback("error" in result ? result.error : "Unable to save assignment.");
        return;
      }

      setFeedback("Student assigned successfully.");
      router.refresh();
    });
  };

  return (
    <Card className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          Assign student to teacher
        </h2>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Each student should have one active teacher by default. Reassigning a
          student here will move them to the selected teacher.
        </p>
      </div>

      <Field label="Teacher">
        <select
          className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
          onChange={(event) => setTeacherId(event.target.value)}
          value={teacherId}
        >
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name} ({teacher.email})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Student">
        <select
          className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
          onChange={(event) => setStudentId(event.target.value)}
          value={studentId}
        >
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name} ({student.email})
            </option>
          ))}
        </select>
      </Field>

      {feedback ? (
        <div className="rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <Button
        disabled={isPending || !teacherId || !studentId}
        onClick={handleAssign}
      >
        {isPending ? "Saving assignment..." : "Assign student"}
      </Button>
    </Card>
  );
}
