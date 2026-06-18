import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LessonWorksheet } from "@/lib/types";

export function WorksheetAttachmentViewer({
  signedUrl,
  worksheet,
}: {
  signedUrl: string | null;
  worksheet: LessonWorksheet;
}) {
  if (!worksheet.file_path) {
    return null;
  }

  const isImage = worksheet.file_mime_type?.startsWith("image/");

  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Badge>Uploaded worksheet</Badge>
            <Badge className="bg-[var(--color-surface-soft)] text-[var(--color-text-soft)]">
              {worksheet.file_mime_type === "application/pdf" ? "PDF" : "Image"}
            </Badge>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text)]">
              {worksheet.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">
              {worksheet.file_name ?? "Worksheet file"}
            </p>
          </div>
        </div>

        {signedUrl ? (
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface-soft)]"
            href={signedUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open full file
          </a>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[var(--color-border)] bg-white shadow-[var(--shadow-card)]">
        {!signedUrl ? (
          <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-sm text-[var(--color-text-soft)]">
            Preparing worksheet file...
          </div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={worksheet.file_name ?? "Uploaded worksheet"}
            className="max-h-[75vh] w-full object-contain"
            src={signedUrl}
          />
        ) : (
          <iframe
            className="h-[75vh] w-full"
            src={signedUrl}
            title={worksheet.file_name ?? "Uploaded worksheet PDF"}
          />
        )}
      </div>
    </Card>
  );
}
