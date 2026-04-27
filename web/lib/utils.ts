import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const parts = [hours, minutes, seconds].map((value) =>
    value.toString().padStart(2, "0"),
  );

  return parts.join(":");
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
