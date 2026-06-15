"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({
  dashboardHref,
}: {
  dashboardHref: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      setFeedback(null);

      if (!password.trim() || !confirmPassword.trim()) {
        setFeedback("Please enter and confirm your new password.");
        return;
      }

      if (password.trim().length < 8) {
        setFeedback("Password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setFeedback("The password confirmation does not match.");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      router.push(dashboardHref);
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-xl p-5 sm:p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Change password
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Update the password for your current signed-in account.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="New password" hint="Use at least 8 characters.">
          <Input
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            type="password"
            value={password}
          />
        </Field>

        <Field label="Confirm new password">
          <Input
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat new password"
            type="password"
            value={confirmPassword}
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
          {isPending ? "Saving password..." : "Save password"}
        </Button>
        <Button
          className="flex-1"
          disabled={isPending}
          onClick={() => router.push(dashboardHref)}
          variant="secondary"
        >
          Back to dashboard
        </Button>
      </div>
    </Card>
  );
}
