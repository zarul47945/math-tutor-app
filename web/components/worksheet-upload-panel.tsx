"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, ClipboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { validateWorksheetFile } from "@/lib/worksheet-files";
import { WORKSHEET_UPLOAD_EXAMPLE } from "@/lib/worksheet-upload";

export function WorksheetUploadPanel({
  attachmentFile,
  existingAttachment,
  inputId = "worksheet-file-upload",
  onAttachmentChange,
  onChange,
  value,
}: {
  attachmentFile?: File | null;
  existingAttachment?: {
    file_mime_type: string | null;
    file_name: string | null;
    file_size_bytes: number | null;
  } | null;
  inputId?: string;
  onAttachmentChange?: (file: File | null) => void;
  onChange: (value: string) => void;
  value: string;
}) {
  const selectedAttachmentName =
    attachmentFile?.name ?? existingAttachment?.file_name ?? null;
  const selectedAttachmentType =
    attachmentFile?.type ?? existingAttachment?.file_mime_type ?? null;
  const selectedAttachmentSize =
    attachmentFile?.size ?? existingAttachment?.file_size_bytes ?? null;

  const handleAttachmentFile = (file: File) => {
    const normalizedFile =
      file.name.trim() || !file.type.startsWith("image/")
        ? file
        : new File(
            [file],
            `pasted-worksheet.${file.type === "image/jpeg" ? "jpg" : "png"}`,
            { type: file.type },
          );

    validateWorksheetFile(normalizedFile);
    onAttachmentChange?.(normalizedFile);
  };

  const handleWorksheetFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  const handleAttachmentFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      handleAttachmentFile(file);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Please upload a PNG, JPEG, or PDF worksheet file.",
      );
    }
  };

  const handlePasteAttachment = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!onAttachmentChange) {
      return;
    }

    const pastedFile =
      [...event.clipboardData.files].find((file) =>
        file.type.startsWith("image/"),
      ) ??
      [...event.clipboardData.items]
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile() ??
      null;

    if (!pastedFile) {
      return;
    }

    try {
      handleAttachmentFile(pastedFile);
      event.preventDefault();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Please paste a PNG or JPEG worksheet image.",
      );
    }
  };

  const formattedAttachmentSize =
    selectedAttachmentSize && selectedAttachmentSize > 0
      ? `${(selectedAttachmentSize / 1024 / 1024).toFixed(2)} MB`
      : null;

  return (
    <div className="space-y-5" onPaste={handlePasteAttachment}>
      <Field
        label="Worksheet questions"
        hint='Optional. Use "1 + ? = 6" or "1,6". Leave one blank line between exercises.'
      >
        <textarea
          className="min-h-48 w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={WORKSHEET_UPLOAD_EXAMPLE}
          value={value}
        />
      </Field>

      <div className="rounded-[24px] border border-dashed border-[var(--color-border-strong)] bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Upload question text
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-soft)]">
              Upload a plain text or CSV file if you want auto-generated answer
              boxes. The file contents will fill the question box above.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
              htmlFor={`${inputId}-text`}
            >
              <Upload className="mr-2" size={18} />
              Upload text/CSV
            </label>
            <input
              accept=".txt,.csv,text/plain,text/csv"
              className="sr-only"
              id={`${inputId}-text`}
              onChange={handleWorksheetFileChange}
              type="file"
            />
            <Button
              onClick={() => onChange(WORKSHEET_UPLOAD_EXAMPLE)}
              type="button"
              variant="secondary"
            >
              <FileText className="mr-2" size={18} />
              Use sample
            </Button>
            <Button
              disabled={!value.trim()}
              onClick={() => onChange("")}
              type="button"
              variant="ghost"
            >
              <Trash2 className="mr-2" size={18} />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {onAttachmentChange ? (
        <div className="rounded-[24px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-soft)] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Worksheet image or PDF
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--color-text-soft)]">
                Upload PNG, JPEG, or PDF. You can also copy an image and paste
                it here with Ctrl+V.
              </p>
              {selectedAttachmentName ? (
                <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[var(--color-text-soft)]">
                  <p className="font-semibold text-[var(--color-text)]">
                    {selectedAttachmentName}
                  </p>
                  <p>
                    {[selectedAttachmentType, formattedAttachmentSize]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
                htmlFor={`${inputId}-attachment`}
              >
                <Upload className="mr-2" size={18} />
                Upload PNG/JPEG/PDF
              </label>
              <input
                accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
                className="sr-only"
                id={`${inputId}-attachment`}
                onChange={handleAttachmentFileChange}
                type="file"
              />
              <Button
                disabled={!attachmentFile}
                onClick={() => onAttachmentChange(null)}
                type="button"
                variant="ghost"
              >
                <Trash2 className="mr-2" size={18} />
                Clear new file
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
