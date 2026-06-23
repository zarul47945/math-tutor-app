"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { deleteTeacherSession } from "@/lib/supabase/queries";

function getDeleteErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Unable to delete this lesson right now.";
}

export function DeleteSessionButton({
  sessionId,
  teacherId,
  title,
}: {
  sessionId: string;
  teacherId: string;
  title: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${title}"? This will remove the lesson from the teacher and student dashboards.`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback(null);
    setIsDeleting(true);

    try {
      const supabase = createClient();
      await deleteTeacherSession(supabase, teacherId, sessionId);
      router.refresh();
    } catch (error) {
      setFeedback(getDeleteErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="min-h-11 rounded-2xl px-5"
        disabled={isDeleting}
        onClick={handleDelete}
        variant="danger"
      >
        {isDeleting ? "Deleting..." : "Delete lesson"}
      </Button>
      {feedback ? (
        <p className="max-w-xs text-xs font-semibold text-[var(--color-danger)]">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
