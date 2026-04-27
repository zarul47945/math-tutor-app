"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function StudentAuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const supabase = createClient();
      setFeedback(null);

      if (!email.trim() || !password.trim()) {
        setFeedback("Please enter your student email and password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setFeedback(error.message);
        return;
      }

      router.push("/student/dashboard");
      router.refresh();
    });
  };

  return (
    <Card className="w-full max-w-xl p-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">
          Student login
        </h1>
        <p className="text-sm leading-6 text-[var(--color-text-soft)]">
          Sign in with your student account to open your personal dashboard and
          join lessons securely. Guest lesson entry has been removed.
        </p>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Email">
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@example.com"
            type="email"
            value={email}
          />
        </Field>

        <Field label="Password">
          <Input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            type="password"
            value={password}
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
          {isPending ? "Logging in..." : "Login"}
        </Button>
        <Link
          href="/teacher/login"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-[var(--color-border)] px-5 text-sm font-semibold text-[var(--color-text-soft)] transition hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          Staff login
        </Link>
      </div>
    </Card>
  );
}
