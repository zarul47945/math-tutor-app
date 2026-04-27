import Link from "next/link";

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
            <p className="text-sm text-[var(--color-text-soft)]">
              Internal room code:{" "}
              <span className="font-mono text-[var(--color-primary-strong)]">
                {session.join_code}
              </span>
            </p>
          </div>
          <Badge>{session.status}</Badge>
        </div>
        <div className="space-y-1 text-sm text-[var(--color-text-soft)]">
          {studentName ? <p>Student: {studentName}</p> : null}
          <p>Created: {formatDateTime(session.created_at)}</p>
          <p>Joined students: {participantCount}</p>
          <p>Recorded time: {formatSeconds(session.elapsed_seconds)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/room/${session.id}?role=teacher&joinCode=${encodeURIComponent(
            session.join_code,
          )}&sessionTitle=${encodeURIComponent(session.title)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-strong)]"
        >
          Enter video room
        </Link>
      </div>
    </Card>
  );
}
