"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { WORKSHEET_UPLOAD_EXAMPLE } from "@/lib/worksheet-upload";

export function WorksheetUploadPanel({
  inputId = "worksheet-file-upload",
  onChange,
  value,
}: {
  inputId?: string;
  onChange: (value: string) => void;
  value: string;
}) {
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

  return (
    <div className="space-y-5">
      <Field
        label="Worksheet questions"
        hint='Use "1 + ? = 6" or "1,6". Leave one blank line between exercises.'
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
              Upload or prepare worksheet
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-soft)]">
              Upload a plain text or CSV file. The file contents will fill the
              question box above.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
              htmlFor={inputId}
            >
              <Upload className="mr-2" size={18} />
              Upload worksheet file
            </label>
            <input
              accept=".txt,.csv,text/plain,text/csv"
              className="sr-only"
              id={inputId}
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
    </div>
  );
}
