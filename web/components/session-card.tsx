import Link from "next/link";

import { DeleteSessionButton } from "@/components/delete-session-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { TeacherSession } from "@/lib/types";
import { formatDateTime, formatSeconds } from "@/lib/utils";

export function SessionCard({
  session,
  studentName,
}: {
  session: TeacherSession;
  studentName?: string;
}) {
  const participantCount = session.session_participants?.[0]?.count ?? 0;

  return (
    <Card className="flex h-full flex-col justify-between gap-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xl font-bold text-[var(--color-text)]">
              {session.title}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge>{session.lesson_mode}</Badge>
            <Badge>{session.status}</Badge>
          </div>
        </div>
        <div className="space-y-1 text-sm text-[var(--color-text-soft)]">
          {studentName ? <p>Student: {studentName}</p> : null}
          <p>
            Mode:{" "}
            {session.lesson_mode === "consultation"
              ? "Consultation"
              : "Therapy"}
          </p>
          <p>Created: {formatDateTime(session.created_at)}</p>
          <p>Attendance: {participantCount > 0 ? "Student joined" : "Waiting"}</p>
          <p>Lesson time: {formatSeconds(session.elapsed_seconds)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href={`/room/${session.id}?role=teacher&joinCode=${encodeURIComponent(
            session.join_code,
          )}&sessionTitle=${encodeURIComponent(
            session.title,
          )}&lessonMode=${encodeURIComponent(session.lesson_mode)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
        >
          Enter classroom
        </Link>
        <Link
          href={`/teacher/sessions/${session.id}/worksheet`}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Edit worksheet
        </Link>
        <DeleteSessionButton
          sessionId={session.id}
          teacherId={session.teacher_id}
          title={session.title}
        />
      </div>
    </Card>
  );
}
