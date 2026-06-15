import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold uppercase text-[var(--color-primary-strong)]",
        className,
      )}
      {...props}
    />
  );
}
