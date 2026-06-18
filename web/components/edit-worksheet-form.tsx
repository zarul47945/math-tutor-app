"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { WorksheetUploadPanel } from "@/components/worksheet-upload-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { worksheetToUploadText } from "@/lib/lesson-worksheet";
import { createClient } from "@/lib/supabase/client";
import { replaceSessionWorksheet } from "@/lib/supabase/queries";
import type { LessonWorksheet, TeacherSession } from "@/lib/types";
import { uploadWorksheetFile } from "@/lib/worksheet-files";
import { parseWorksheetUpload } from "@/lib/worksheet-upload";

export function EditWorksheetForm({
  session,
  teacherId,
  worksheet,
}: {
  session: TeacherSession;
  teacherId: string;
  worksheet: LessonWorksheet | null;
}) {
  const router = useRouter();
  const [worksheetText, setWorksheetText] = useState(() =>
    worksheetToUploadText(worksheet),
  );
  const [worksheetFile, setWorksheetFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const classroomHref = `/room/${session.id}?role=teacher&joinCode=${encodeURIComponent(
    session.join_code,
  )}&sessionTitle=${encodeURIComponent(session.title)}`;

  const handleSaveWorksheet = () => {
    startTransition(async () => {
      const supabase = createClient();
      setFeedback(null);
      setSavedAt(null);

      if (!worksheetText.trim() && !worksheetFile && !worksheet?.file_path) {
        setFeedback("Please add questions or upload a PNG, JPEG, or PDF worksheet.");
        return;
      }

      try {
        const parsedWorksheet = worksheetText.trim()
          ? parseWorksheetUpload(worksheetText)
          : null;
        const worksheetAttachment = worksheetFile
          ? await uploadWorksheetFile({
              file: worksheetFile,
              sessionId: session.id,
              supabase,
              teacherId,
            })
          : undefined;

        await replaceSessionWorksheet({
          attachment: worksheetAttachment,
          instructions:
            parsedWorksheet?.instructions ??
            "Open the uploaded worksheet file during the lesson.",
          sessionId: session.id,
          sets: parsedWorksheet?.sets ?? [],
          supabase,
          teacherId,
          title: parsedWorksheet?.title ?? "Uploaded worksheet",
        });

        setWorksheetFile(null);
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Unable to save this worksheet right now.",
        );
      }
    });
  };

  return (
    <Card className="mx-auto max-w-5xl p-5 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Badge>Worksheet editor</Badge>
            <Badge className="bg-[var(--color-surface-soft)] text-[var(--color-text-soft)]">
              {worksheet ? "Existing worksheet" : "No worksheet yet"}
            </Badge>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
              Edit worksheet
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-soft)]">
              Upload or paste questions for <strong>{session.title}</strong>.
              The student will see this worksheet inside the classroom.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={classroomHref}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
          >
            Back to classroom
          </Link>
          <Link
            href="/teacher/dashboard"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <WorksheetUploadPanel
          attachmentFile={worksheetFile}
          existingAttachment={
            worksheet
              ? {
                  file_mime_type: worksheet.file_mime_type,
                  file_name: worksheet.file_name,
                  file_size_bytes: worksheet.file_size_bytes,
                }
              : null
          }
          inputId="edit-worksheet-file-upload"
          onAttachmentChange={setWorksheetFile}
          onChange={setWorksheetText}
          value={worksheetText}
        />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          disabled={isPending}
          onClick={handleSaveWorksheet}
          className="sm:w-auto"
        >
          {isPending ? "Saving worksheet..." : "Save worksheet"}
        </Button>
        <Link
          href={classroomHref}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
        >
          Open classroom
        </Link>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      {savedAt ? (
        <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-soft)]">
          Worksheet saved at {savedAt}. Reopen the classroom if it is already
          open in another tab.
        </div>
      ) : null}
    </Card>
  );
}
