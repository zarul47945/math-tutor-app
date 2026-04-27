"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { joinSessionAsStudentAccount } from "@/lib/supabase/queries";
import type { StudentSessionSummary } from "@/lib/types";
import { formatDateTime, formatSeconds } from "@/lib/utils";

export function StudentAssignedSessionCard({
  session,
}: {
  session: StudentSessionSummary;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleJoin = () => {
    startTransition(async () => {
      const supabase = createClient();
      setFeedback(null);

      try {
        const result = await joinSessionAsStudentAccount(
          supabase,
          session.session_id,
        );

        if (!result) {
          setFeedback("This lesson is no longer active.");
          return;
        }

        router.push(
          `/room/${result.session.id}?role=student&joinCode=${encodeURIComponent(
            result.session.join_code,
          )}&participantId=${encodeURIComponent(
            result.participant.id,
          )}&sessionTitle=${encodeURIComponent(result.session.title)}`,
        );
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to join the lesson right now.",
        );
      }
    });
  };

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xl font-bold text-[var(--color-text)]">
            {session.title}
          </p>
          <p className="text-sm text-[var(--color-text-soft)]">
            Created: {formatDateTime(session.created_at)}
          </p>
          <p className="text-sm text-[var(--color-text-soft)]">
            Recorded time: {formatSeconds(session.elapsed_seconds)}
          </p>
          <p className="text-sm text-[var(--color-text-soft)]">
            Lesson module: Therapy worksheet demo
          </p>
        </div>
      </div>

      {feedback ? (
        <div className="rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <Button disabled={isPending} onClick={handleJoin}>
        {isPending ? "Joining lesson..." : "Join lesson"}
      </Button>
    </Card>
  );
}
