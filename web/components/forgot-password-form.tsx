"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setFeedback(null);
      setIsSent(false);

      if (!email.trim()) {
        setFeedback("Please enter your account email.");
        return;
      }

      const redirectTo =
        typeof window === "undefined"
          ? undefined
          : `${window.location.origin}/password/reset`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo,
        },
      );

      if (error) {
        setFeedback(error.message);
        return;
      }

      setIsSent(true);
      setFeedback(
        "Recovery email sent. Open the newest email from Supabase and continue from that link.",
      );
    });
  };

  return (
    <Card className="w-full max-w-xl p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Reset password
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Enter the email for your admin, teacher, or student account and we
          will send a recovery link.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Email">
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </Field>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-text-soft)]">
          {feedback}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Sending link..." : "Send recovery link"}
        </Button>
        <Link
          href="/teacher/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          Staff login
        </Link>
        <Link
          href="/student/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          Student login
        </Link>
      </div>

      {isSent ? (
        <p className="mt-5 text-xs leading-6 text-[var(--color-text-soft)]">
          If the email does not arrive, check spam first, then wait a minute
          before trying again because Supabase applies email rate limits.
        </p>
      ) : null}
    </Card>
  );
}
