import type { SupabaseClient } from "@supabase/supabase-js";

export const WORKSHEET_FILE_BUCKET = "worksheet-files";

const MAX_WORKSHEET_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_WORKSHEET_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export type WorksheetAttachment = {
  file_mime_type: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
};

function safeFileName(fileName: string) {
  const cleanedName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanedName || "worksheet-file";
}

export function validateWorksheetFile(file: File) {
  if (!ALLOWED_WORKSHEET_FILE_TYPES.has(file.type)) {
    throw new Error("Please upload a PNG, JPEG, or PDF worksheet file.");
  }

  if (file.size > MAX_WORKSHEET_FILE_SIZE_BYTES) {
    throw new Error("Worksheet file is too large. Please upload a file under 25MB.");
  }
}

export async function uploadWorksheetFile({
  file,
  sessionId,
  supabase,
  teacherId,
}: {
  file: File;
  sessionId: string;
  supabase: SupabaseClient;
  teacherId: string;
}): Promise<WorksheetAttachment> {
  validateWorksheetFile(file);

  const filePath = `${teacherId}/${sessionId}/${Date.now()}-${safeFileName(
    file.name,
  )}`;
  const { error } = await supabase.storage
    .from(WORKSHEET_FILE_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    file_mime_type: file.type,
    file_name: file.name,
    file_path: filePath,
    file_size_bytes: file.size,
  };
}

export async function createWorksheetFileSignedUrl(
  supabase: SupabaseClient,
  filePath: string | null,
) {
  if (!filePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(WORKSHEET_FILE_BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
