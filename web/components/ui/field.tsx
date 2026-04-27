import type { ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[var(--color-text)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-text-soft)]">{hint}</span>
      ) : null}
    </label>
  );
}
